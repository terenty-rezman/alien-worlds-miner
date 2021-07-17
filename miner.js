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
  const webgl_content = document.querySelector(".webgl-content");
  webgl_content.appendChild(ui);

  // create status bar
  const statusbar = document.createElement("div");
  statusbar.classList.add("miner-statusbar");
  statusbar.textContent = "alien-worlds-miner";
  ui.appendChild(statusbar);
  miner.ui.statusbar = statusbar;

  // create bag bar
  const bag = document.createElement("div");
  bag.classList.add("miner-bag");
  bag.textContent = "bag: click to refresh";
  ui.appendChild(bag);
  miner.ui.bag = bag;

  bag.addEventListener("click", async function () {
    const ACCOUNT = wax.userAccount;
    const items = await my_getBag(ACCOUNT);
    let bag_str = "bag: [";

    for (item of items) {
      bag_str += item.asset_id + ", "
    }
    bag_str = bag_str.slice(0, -2);

    bag_str += "] click to refresh";
    bag.textContent = bag_str;
  });

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

  // Claim nft button
  const claimnfts = document.createElement("button");
  claimnfts.classList.add("miner-claimnfts");
  claimnfts.classList.add("miner-hidden");

  claimnfts.textContent = "claim nfts";

  ui.appendChild(claimnfts);
  miner.ui.claimnfts = claimnfts;

  // 3. Add event handler
  claimnfts.addEventListener("click", function () {
    try_claimnft();
  });

  update_unclaimed_nft_count();
}

async function update_unclaimed_nft_count() {
  // const now = Date.now();
  // const last_claim = localStorage.getItem("last_nft_claim_date");
  // if (last_claim)
  //   miner.ui.claimnfts.textContent = "claim nfts" + ` (last ${ms_to_time(now - last_claim)} ago)`;
  try {
    const unclaimed_nfts = await get_unclaimed_nfts();
    const nft_count = unclaimed_nfts.rows.length;
    if (nft_count > 0) {
      miner.ui.claimnfts.textContent = "claim nfts" + ` (${nft_count} unclaimed nft !)`;
      miner.ui.claimnfts.classList.remove("miner-hidden");
    }
    else {
      miner.ui.claimnfts.textContent = "claim nfts (0)";
      miner.ui.claimnfts.classList.add("miner-hidden");
    }
  }
  catch (e) {
    console.log(e);
  }
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

var test_popup_close = async function () {
  monkey_patch_popup();
  await try_close_popup();
  console.log("POPUP CLOSED !")
}

var my_background_mine = async (account, timeout_ms) => {
  let bagDifficulty = await getBagDifficulty(account);
  bagDifficulty = parseInt(bagDifficulty) || 0; // [!]

  let landDifficulty = await getLandDifficulty(account);
  landDifficulty = parseInt(landDifficulty) || 0; // [!]

  const difficulty = bagDifficulty + landDifficulty;
  console.log('difficulty', difficulty);

  console.log('start doWork = ' + Date.now());
  const last_mine_tx = await lastMineTx(mining_account, account, wax.api.rpc);

  return await doWorkWorker({ mining_account, account, difficulty, last_mine_tx });
};

var my_mine = async function (account, timeout_ms) {
  try {
    const mine_work = await my_background_mine(account, timeout_ms);
    unityInstance.SendMessage('Controller', 'Server_Response_Mine', JSON.stringify(mine_work));
    return JSON.stringify(mine_work);
  } catch (error) {
    unityInstance.SendMessage('ErrorHandler', 'Server_Response_SetErrorData', error.message);
    throw error;
  }
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
        reject(err);
      }
      );
    } catch (error) {
      unityInstance.SendMessage('ErrorHandler', 'Server_Response_SetErrorData', error.message);
      reject(err);
    }
  });
}

async function my_getBalance(account) {
  try {
    var data = await getBalance(account, wax.api.rpc);
    unityInstance.SendMessage('Controller', 'Server_Response_GetBalance', data);
    let number = parseFloat(data);
    return number;
  } catch (error) {
    unityInstance.SendMessage(
      'ErrorHandler',
      'Server_Response_SetErrorData',
      error.message
    );
  }
}

async function my_getBag(account) {
  try {
    var data = await getBag(mining_account, account, wax.api.rpc, aa_api);
    unityInstance.SendMessage(
      'Controller',
      'Server_Response_GetBag',
      JSON.stringify(data)
    );
    return data;
  } catch (error) {
    unityInstance.SendMessage(
      'ErrorHandler',
      'Server_Response_SetErrorData',
      error.message
    );
  }
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


async function throw_on_timeout(fn, what, timeout) {
  let result = await Promise.race([
    fn(),
    new Promise((res, rej) => setTimeout(rej.bind(this, what), timeout))
  ]);

  return result;
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

const my_claimnft = async () => {
  const actions = [{
    account: mining_account,
    name: 'claimnfts',
    authorization: [{
      actor: wax.userAccount,
      permission: 'active',
    }],
    data: {
      account: wax.userAccount,
      miner: wax.userAccount
    }
  }];
  const res = await wax.api.transact({
    actions
  }, {
    blocksBehind: 3,
    expireSeconds: 90,
  });

  return res;
}

async function get_unclaimed_nfts() {
  return await wax.api.rpc.get_table_rows({
    code: mining_account, scope: mining_account, table: 'claims', limit: 100,
    lower_bound: wax.userAccount,
    upper_bound: wax.userAccount
  });
}

async function try_claimnft() {
  const result = await my_claimnft();
  //localStorage.setItem('last_nft_claim_date', Date.now());
  await update_unclaimed_nft_count();
}

function do_every_nth_iteration(f, n) {
  let iter = -1;
  return async function () {
    iter++;
    if (iter % n == 0) {
      return f();
    }
  }
}

function disable_unity_animation() {
  requestAnimationFrame = () => { };
}

function change_wax_endpoint() {
  wax.rpc.endpoint = "https://chain.wax.io";
  console.log("wax endpoint set to", wax.rpc.endpoint);
}

var my_mine_loop = async function () {
  var ACCOUNT = wax.userAccount;
  const NIGHT_MS = 7 * 60 * 60 * 1000;
  const WORK_DAY_MS = 24 * 60 * 60 * 1000 - NIGHT_MS;

  monkey_patch_popup();

  const elapsed = start_timer();
  let awake = start_timer();
  let start_balance = 0;
  let mine_count = 0;
  let cpu_fails = 0;

  try { start_balance = await my_getBalance(ACCOUNT); }
  catch { }

  const print_status = async () => {
    const uptime_ = uptime(elapsed());
    const balance = await my_getBalance(ACCOUNT);
    const earned = (balance - start_balance).toFixed(3);
    const efficiency = (earned / elapsed() * 60 * 60 * 1000).toFixed(3); // TML/hour

    miner.ui.set_statusbar(
      `balance: ${balance} TLM | total earned: ${earned} TLM | efficiency: ${efficiency} TLM/hour | uptime: ${uptime_} | mine count: ${mine_count} | cpu fails: ${cpu_fails}`
    );
  }

  while (true) {
    try {
      let delay = await getMineDelay(ACCOUNT);

      if (delay > 0)
        await countdown(delay, "wating for mine timeout");

      miner.print("MINING");
      mine_work = await throw_on_timeout(
        my_mine.bind(this, ACCOUNT), "timeout on mining", 3 * 60 * 1000
      );

      await sleep_random(0, 2 * 60 * 1000); // sleep additional random secs

      miner.print("CLAIMING RESULT");
      await retry_on_timeout(my_claim.bind(this, mine_work), close_last_popup, 3 * 60 * 1000);

      miner.print("DONE CLAIMING");

      mine_count++;

      print_status();

      await countdown(3 * 1000, "waiting a little"); // sleep additional secs

      await update_unclaimed_nft_count();

      if (awake() > WORK_DAY_MS) {
        await countdown(NIGHT_MS, "ZzzZZzzZZzz..."); // sleeping in bed
        miner.print("Waking up");
        await sleep_random(0, 20 * 60 * 1000); // sleep additional random secs
        awake = start_timer();
      }
    }
    catch (error) {
      const alien_error = error?.json?.error;
      if (alien_error && error?.json?.error?.name === "tx_cpu_usage_exceeded") {
        miner.print(alien_error?.what || alien_error);
        cpu_fails++;
        print_status();
        await countdown(12 * 60 * 1000, "CPU cooldown");
        continue;
      }

      miner.print(error);
      await my_sleep(3 * 1000);
    }
  }
}

var main = async function () {
  // await wait_for_msg("Loaded HomeScene");
  miner_init_ui();
  disable_unity_animation();
  await wait_for_msg("Input Manager initialize...");
  change_wax_endpoint();
}

//miner_init_ui();
main();
