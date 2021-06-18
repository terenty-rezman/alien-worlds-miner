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

const TIME_TO_F5 = 60 * 1000; // ms

var try_login = async function () {
    const elapsed = start_timer();

    while (true) { 
        await my_sleep(5 * 1000);

        const login_with_google = document.querySelector("#google-social-btn");
        if (login_with_google) {
            login_with_google.click();
        }

        if(elapsed() > TIME_TO_F5)
            reload_page();
    }
}

try_login();