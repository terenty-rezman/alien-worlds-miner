var inject_script = function (name) {
    var s = document.createElement('script');
    // TODO: add "script.js" to web_accessible_resources in manifest.json
    s.src = chrome.runtime.getURL(name);
    s.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(s);
}

if(window.origin === "https://play.alienworlds.io")
    inject_script("miner.js");
else if(window.location.href === "https://all-access.wax.io/cloud-wallet/signing/")
    inject_script("wax_popup.js");
