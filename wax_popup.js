var my_sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

var try_self_autoclose = async function () {
    while (true) {
        const approve = document.querySelector(".button");
        if (approve) {
            captcha_is_hidden = approve.getAttribute("disabled") === null;
            if (captcha_is_hidden) {
                approve.click();
                return;
            }
        }

        await my_sleep(2 * 1000);
    }
}

try_self_autoclose()
