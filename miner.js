const miner = {
  events: new EventTarget(),
  is_mining: false,
  ui: {
    set_statusbar: function (msg) {
      this.statusbar.textContent = msg;
    }

    /* items added here at miner_init_ui() */
  },

  print: function () {
    // console.log(...arguments);
    if (this.is_mining) {
      const info = this.ui.info;
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
        .miner-ui-container {
            position: absolute;
            margins: 0px;
            border: none;
            outline: none;
            top: 0;
            bottom: 0;
            left: 0;
            right: 0;

            pointer-events: none;

            display: flex;
            flex-direction: column-reverse;
            align-items: flex-start;
            z-index: 1000;
        }

        .miner-statusbar {
            padding: 5px 10px;
            color: #bbb;
            background: #424242ee;
            align-self: stretch;
            text-weight: bold;
        }

        .miner-bag {
            color: rgba(255, 255, 255, 0.7);
            background: #2C2F33;
            padding: 5px 10px;

            pointer-events: auto;
            cursor: pointer;

            border: none;
            outline: none;
        }

        .miner-widget {
            margins: 0px;
            line-height: 60px;
            font-weight: bold;
            padding: 0 40px;

            border: none;
            outline: none;
            transition: background 0.2s
        }

        .miner-button {
            pointer-events: auto;
            cursor: pointer;
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

        .miner-claimnfts {
          color: #fff;
          background: rgba(20, 193, 150, 1);
          padding: 20px 20px;

          pointer-events: auto;
          cursor: pointer;

          border: none;
          outline: none;
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

  // create miner ui container
  const ui = document.createElement("div");
  ui.classList.add("miner-ui-container");

  // append container over webgl viewport
  const root_item = document.querySelector("#root");
  root_item.appendChild(ui);

  // create status bar
  const statusbar = document.createElement("div");
  statusbar.classList.add("miner-statusbar");
  statusbar.textContent = "alien-worlds-miner";
  ui.appendChild(statusbar);
  miner.ui.statusbar = statusbar;

  // create the Mining button
  const button = document.createElement("button");
  button.classList.add("miner-widget");
  button.classList.add("miner-button");

  button.textContent = "start mining";

  ui.appendChild(button);
  miner.ui.info = button;

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

var my_sleep = function (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function rand_int(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; // max not included
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

var sleep_random = async function (min_ms, max_ms) {
  const sleep_ms = rand_int(min_ms, max_ms);
  return await countdown(sleep_ms, "RANDOM SLEEP");
}

var uptime = function (ms_elapsed) {
  let secs = Math.floor(ms_elapsed / 1000); // secs

  const days = Math.floor(secs / (60 * 60 * 24));
  secs -= days * (60 * 60 * 24);

  const hours = Math.floor(secs / (60 * 60));
  secs -= hours * (60 * 60);

  const mins = Math.floor(secs / 60);
  secs -= mins * (60);

  secs = Math.floor(secs);

  return `${days} days, ${hours} hours, ${mins} mins, ${secs} seconds`;
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

function disable_unity_animation() {
  requestAnimationFrame = () => { };
}

function change_wax_endpoint() {
  wax.rpc.endpoint = "https://chain.wax.io";
  console.log("wax endpoint set to", wax.rpc.endpoint);
}

function elem_contains(selector, text) {
  var elements = document.querySelectorAll(selector);
  return Array.prototype.filter.call(elements, function(element){
    return element.textContent === text;
  });
}

function extract_wait_time() {
  const text_elems = elem_contains('p', "Next Mine Attempt");
  const time_str = text_elems.length ? text_elems[0].previousElementSibling.textContent : null;

  let wait_ms = 0;
  if (time_str)
     wait_ms = Number(time_str.split(':')[0]) * 60 * 60 * 1000 + Number(time_str.split(':')[1]) * 60 * 1000 + Number(time_str.split(':')[2] * 1000);

  return wait_ms;
}

function find_mine_button() {
  const text_elems = elem_contains('span', "Mine");
  const mine_button = text_elems.length ? text_elems[0].parentElement.parentElement : null;
  return mine_button;
}

function find_claim_button() {
  const text_elems = elem_contains('span', "Claim Mine");
  const claim_mine = text_elems.length ? text_elems[0].parentElement.parentElement : null;
  return claim_mine;
}

var my_mine_loop = async function () {
  const elapsed = start_timer();

  const print_status = async () => {
    const uptime_ = uptime(elapsed());
    miner.ui.set_statusbar(
      ` uptime: ${uptime_}`
    );
  }

  while (true) {
    try {
      const wait_ms = extract_wait_time();

      if (wait_ms)
        await countdown(wait_ms, "wating for mine timeout");
      
      const mine_button = find_mine_button();
      if (mine_button) {
        mine_button.click();
        await countdown(3 * 1000, "mining");
      }

      const claim_button = find_claim_button();
      if (claim_button) {
        claim_button.click();
        await countdown(3 * 1000, "claiming mine");
      }

      print_status();

      await countdown(3 * 1000, "waiting a little"); // sleep additional secs
    }
    catch (error) {
      miner.print(error);
      await my_sleep(3 * 1000);
    }
  }
}

var main = async function () {
  await wait_for_msg("Navigating to inventory");
  miner_init_ui();
}

main();
