const miner = {
    events: new EventTarget(),
    is_mining: false,

    print: function () {
        console.log(...arguments);
        if (this.is_mining) {
            const info = document.querySelector(".miner-ui");
            let args = [...arguments];
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
}

// intercept console.log to make it possible to await on some console messages
window.old_log = window.console.log;

window.console.log = function (msg) {
    window.old_log.apply(window, arguments);

    const event = new CustomEvent("console_log", { detail: msg });
    miner.events.dispatchEvent(event);
}

var wait_for_msg = async function (msg) {
    return new Promise(resolve => {
        const handler = function (event) {
            const message = event.detail;
            if (typeof message === 'string' || message instanceof String) {
                if (message.includes(msg)) {
                    miner.events.removeEventListener("console_log", handler);
                    resolve();
                }
            }
        }

        miner.events.addEventListener("console_log", handler);
    })
}

var miner_init_ui = function () {
    // Create our stylesheet
    const style = document.createElement('style');
    style.innerHTML =
        `
        .miner-ui {
            position: absolute;
            margin-bottom: 0px;
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
            background: #fbc02d;
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
        if (miner.is_mining == false) {
            button.classList.remove("miner-button")
            button.classList.add("miner-info");
            miner.is_mining = true;
            my_mine_loop();
        }
    });
}

// mining script below
var BAG = [1, 2, 3];

var my_set_bag = async function () {
    var ACCOUNT = wax.userAccount;
    bag_str = JSON.stringify({ items: BAG });
    miner.print("SETTING BAG")
    await server_setBag(ACCOUNT, bag_str);
    miner.print("BAG SET")
}

var my_sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

var start_timer = function () {
    const start = Date.now();
    return function () {
        return Date.now() - start;
    }
}

var countdown = async function (ms, msg) {
    const elapsed = start_timer();
    while (elapsed() < ms) {
        const ms_left = Math.floor((ms - elapsed()));
        miner.print(msg, ms_to_time(ms_left));
        await my_sleep(1 * 1000);
    }
}

function ms_to_time(duration) {
    let seconds = Math.floor((duration / 1000) % 60);
    let minutes = Math.floor((duration / (1000 * 60)) % 60);
    let hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return hours + ":" + minutes + ":" + seconds;
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

    miner.print('window.open monkey patched')
}

var close_last_popup = function () {
    if (window.last_popup) {
        if (window.last_popup.closed == false) {
            window.last_popup.close();
        }
        window.last_popup = null;
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

var my_claim = async function (data) {
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
        } catch (error) {
            unityInstance.SendMessage('ErrorHandler', 'Server_Response_SetErrorData', error.message);
            reject();
        }
    });
}

async function retry_on_timeout(fn, do_when_timeount, timeout) {
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

            do_when_timeount();
            miner.print(err);
            miner.print("RETRYING FUNCTION", fn.name);
        }

        await my_sleep(1 * 1000);
    }
}

async function retry_on_reject(fn, reject_vallue) {
    while (true) {
        try {
            const result = await fn();
            return result;
        }
        catch (err) {
            if (reject_vallue && err !== reject_vallue)
                throw err;

            miner.print(err);
            miner.print("RETRYING FUNCTION", fn.name);
        }
        await my_sleep(1 * 1000);
    }
}

var my_mine_loop = async function () {
    var ACCOUNT = wax.userAccount;

    monkey_patch_popup();

    while (true) {
        try {
            let mine_work = localStorage.getItem("miner_last_mine_data");

            // mine if unclaimed prev mine data
            if (!mine_work) {
                let delay = await getMineDelay(ACCOUNT);

                if (delay > 0)
                    await countdown(delay, "WATING FOR MINE");

                await my_sleep(3 * 1000); // sleep additional secs
                miner.print("MINING");
                mine_work = await my_mine(ACCOUNT);
                localStorage.setItem("miner_last_mine_data", mine_work);
            }

            miner.print("CLAIMING RESULT");
            await retry_on_timeout(my_claim.bind(this, mine_work), close_last_popup, 5 * 60 * 1000);

            localStorage.removeItem("miner_last_mine_data");

            miner.print("DONE CLAIMING");
            await my_sleep(3 * 1000); // sleep additional secs
        }
        catch (error) {
            miner.print(error);
            localStorage.removeItem("miner_last_mine_data");
            await my_sleep(3 * 1000);
        }
    }
}

var main = async function () {
    await wait_for_msg("Loaded HomeScene");
    miner_init_ui();
}

main();
