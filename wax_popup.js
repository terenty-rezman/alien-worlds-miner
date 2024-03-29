var my_sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

var start_timer = function () {
    const start = Date.now();
    return function () {
        return Date.now() - start;
    }
}

var reload_page = function() {
    // chrome way of page reload
    location.reload();
    window.location.href = window.location.href;
}

const TIME_TO_F5 = 40 * 1000; // ms

var try_self_autoclose = async function () {
    const elapsed = start_timer();

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

        if(elapsed() > TIME_TO_F5)
            reload_page();
    }
}

try_self_autoclose()
