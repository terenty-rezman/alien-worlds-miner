miner_events = new EventTarget();

is_mining = false;

// intercept console.log to make it possible to await on some console messages
window.old_log = window.console.log;

window.console.log = function (msg) {
    window.old_log.apply(window, arguments);

    const event = new CustomEvent("console_log", { detail: msg });
    miner_events.dispatchEvent(event);

    if (is_mining) {
        const info = document.querySelector(".miner-ui");
        let args = Array.from(arguments);
        let string = "";
        for (arg of args) {
            try {
                string += arg.toString() + " ";
            }
            catch { }
        }
        info.textContent = string;
    }
}

var wait_for_msg = async function (msg) {
    return new Promise(resolve => {
        const handler = function (event) {
            const message = event.detail;
            if (typeof message === 'string' || message instanceof String) {
                if (message.includes(msg)) {
                    miner_events.removeEventListener("console_log", handler);
                    resolve();
                }
            }
        }

        miner_events.addEventListener("console_log", handler);
    })
}

var miner_init_ui = function () {
    // Create our stylesheet
    const style = document.createElement('style');
    style.innerHTML =
        `
        .miner-ui {
            position: absolute;
            margin-bottom: 20px;
            line-height: 60px;
            font-weight: bold;
            padding: 0 40px;

            border: none;
            outline: none;
            left: 0;
            bottom: 0;
            transition: background 0.2s
        }

        .miner-button {
            background: #e91e63;
        }

        .miner-info {
            background: #DEAE51;
            max-width: 800px;
            overflow: hidden;
            white-space: nowrap;
            display: block;
            text-overflow: ellipsis;
        }

        .miner-hidden {
            visibility: hidden;
        }

        .miner-button:hover {
            background: #fd3582;
        }`;

    // Get the first script tag
    const body = document.querySelector('body');

    // Insert our new styles before the first script tag
    body.appendChild(style);

    // 1. Create the button
    const button = document.createElement("button");
    button.classList.add("miner-ui");
    button.classList.add("miner-button");

    button.innerHTML = "start mining";

    // append somewhere
    const webgl_content = document.querySelector(".webgl-content");
    webgl_content.appendChild(button);

    // 3. Add event handler
    button.addEventListener("click", function () {
        if (is_mining == false) {
            button.classList.remove("miner-button")
            button.classList.add("miner-info");
            is_mining = true;
            my_mine_loop();
        }
    });
}

// mining script below
var BAG = [1, 2, 3];

var my_set_bag = async function () {
    bag_str = JSON.stringify({ items: BAG });
    console.log("SETTING BAG")
    await server_setBag(ACCOUNT, bag_str);
    console.log("BAG SET")
}

var my_sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

var my_open = function () {
    var popup = window.old_open.apply(window, arguments);
    last_popup = popup;
    return popup;
};

var monkey_patch_popup = function () {
    if (window.old_open)
        return;

    window.last_popup = null;
    window.old_open = window.open;
    window.open = my_open;

    console.log('window.open monkey patched')
}

var wait_popup_closed = async function () {
    while (true) {
        if (window.last_popup) {
            if (window.last_popup.closed) {
                window.last_popup = null;
                return;
            }
        }

        await my_sleep(2 * 1000); // sleep untill popup appears
    }
}

var test_popup_close = async function () {
    monkey_patch_popup();
    await try_close_popup();
    console.log("POPUP CLOSED !")
}

var my_mine = function (account) {
    return new Promise((resolve, reject) => {
        try {
            background_mine(account).then((mine_work) => {
                unityInstance.SendMessage('Controller', 'Server_Response_Mine', JSON.stringify(mine_work));
                resolve(JSON.stringify(mine_work));
            });
        } catch (error) {
            unityInstance.SendMessage('ErrorHandler', 'Server_Response_SetErrorData', error.message);
            reject(error.message);
        }
    });
}

var my_claim = function (data) {
    return new Promise((resolve, reject) => {
        var mine_work = JSON.parse(data);
        try {
            console.log(`${mine_work.account} Pushing mine results...`);
            const mine_data = {
                miner: mine_work.account,
                nonce: mine_work.rand_str,
            };
            console.log('mine_data', mine_data);
            const actions = [{
                account: mining_account,
                name: 'mine',
                authorization: [{
                    actor: mine_work.account,
                    permission: 'active',
                },],
                data: mine_data,
            },];
            wax.api.transact({
                actions,
            }, {
                blocksBehind: 3,
                expireSeconds: 90,
            }).then((result) => {
                console.log('result is=', result);
                var amounts = new Map();
                if (result && result.processed) {
                    result.processed.action_traces[0].inline_traces.forEach((t) => {
                        if (t.act.data.quantity) {
                            const mine_amount = t.act.data.quantity;
                            console.log(`${mine_work.account} Mined ${mine_amount}`);
                            if (amounts.has(t.act.data.to)) {
                                var obStr = amounts.get(t.act.data.to);
                                obStr = obStr.substring(0, obStr.length - 4);
                                var nbStr = t.act.data.quantity;
                                nbStr = nbStr.substring(0, nbStr.length - 4);
                                var balance = (parseFloat(obStr) + parseFloat(nbStr)).toFixed(4);
                                amounts.set(t.act.data.to, balance.toString() + ' TLM');
                            } else {
                                amounts.set(t.act.data.to, t.act.data.quantity);
                            }
                        }
                    }
                    );
                    unityInstance.SendMessage('Controller', 'Server_Response_Claim', amounts.get(mine_work.account));
                    resolve();
                }
            }
            ).catch((err) => {
                unityInstance.SendMessage('ErrorHandler', 'Server_Response_SetErrorData', err.message);
                reject();
            }
            );

            wait_popup_closed();

        } catch (error) {
            unityInstance.SendMessage('ErrorHandler', 'Server_Response_SetErrorData', error.message);
            reject();
        }
    });
}

async function retry_after_timeout(fn, timeout) {
    while (true) {
        try {
            let result = await Promise.race([
                fn(),
                new Promise((res, rej) => setTimeout(rej.bind(this, "timeout"), timeout))
            ]);

            return result;
        }
        catch (err) {
            if (err !== "timeout")
                throw err;

            console.log(err);
            console.log("RETRYING FUNCTION", fn.name);
        }
    }
}

var my_mine_loop = async function () {
    var ACCOUNT = wax.userAccount;

    monkey_patch_popup();

    while (true) {
        try {
            let delay = await getMineDelay(ACCOUNT);
            console.log("WATING FOR MINE for", delay / 1000);
            await my_sleep(delay);
            await my_sleep(3 * 1000); // sleep additional secs
            console.log("START MINING");
            mine_work = await my_mine(ACCOUNT);
            console.log("MINING REUSLT", mine_work);
            await retry_after_timeout(my_claim.bind(this, mine_work), 3 * 60 * 1000);
            console.log("DONE");
            await my_sleep(3 * 1000); // sleep additional secs
        }
        catch (error) {
            console.log("error");
        }
    }
}

var main = async function () {
    await wait_for_msg("Loaded HomeScene");
    miner_init_ui();
}

main();
