miner_events = new EventTarget();

// intercept console.log to make it possible to await on some console messages
window.old_log = window.console.log;

window.console.log = function (msg) {
    window.old_log.apply(window, arguments);

    const event = new CustomEvent("console_log", { detail: msg });
    miner_events.dispatchEvent(event);
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

var miner_init_ui = function() {
    // Create our stylesheet
    const style = document.createElement('style');
    style.innerHTML =
        `.miner-button {
            position: absolute;
            margin-top: 20px;
            line-height: 60px;
            font-weight: bold;
            padding: 0 40px;
            background: #e91e63;
            border: none;
            outline: none;
            left: 0;
            top: 0;
            transition: background 0.2s
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
    button.classList.add("miner-button");

    button.innerHTML = "start mining";

    // append somewhere
    const webgl_content = document.querySelector(".webgl-content");
    webgl_content.appendChild(button);

    // 3. Add event handler
    button.addEventListener("click", function () {
        console.log(wax.userAccount);
        button.classList.add("miner-hidden");
    });
}

var main = async function () {
    await wait_for_msg("Loaded HomeScene");
    miner_init_ui();
}

main();
