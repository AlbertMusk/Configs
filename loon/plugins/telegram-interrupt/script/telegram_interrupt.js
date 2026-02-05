/**
 * Telegram 请求打断脚本（Script 版）
 * 触发方式：Rewrite -> script-response-body
 */

/* ================== 参数读取 & 校验 ================== */

const args = $argument || {};

const POLICY_GROUP     = args.policy_group     || "Telegram";
const BLOCK_POLICY     = args.block_policy     || "DIRECT";
const RECOVER_POLICY   = args.recover_policy   || "Proxy";

const INTERRUPT_MS     = parseInt(args.interrupt_duration || 300);
const LINGER_MS        = parseInt(args.linger_time || 1500);

const SIZE_THRESHOLD   = parseInt(args.size_threshold || 300);
const MIN_INTERVAL     = parseInt(args.min_interval || 2000);

const ENABLE_NOTIFY    = args.enable_notify === "1";

/* ================== 环境校验 ================== */

// 只在前台 App
if (!$environment || !$environment.isForegroundApp) {
  $done({});
  return;
}

// 必须是 Telegram
if (!$request || !$request.url.includes("api.telegram.org")) {
  $done({});
  return;
}

/* ================== 智能判断：是否有新消息 ================== */

let body = $response?.body || "";
if (body.length < SIZE_THRESHOLD) {
  // 响应太小，基本是心跳 / ack
  $done({});
  return;
}

/* ================== 防抖：最小间隔 ================== */

const now = Date.now();
const lastTime = Number($persistentStore.read("tg_interrupt_ts") || 0);

if (now - lastTime < MIN_INTERVAL) {
  $done({});
  return;
}

$persistentStore.write(String(now), "tg_interrupt_ts");

/* ================== 策略切换核心逻辑 ================== */

(async () => {
  try {
    // 当前子策略
    const current = await $policy.getSelectedPolicy(POLICY_GROUP);

    // 如果已经是 block_policy，不重复打断
    if (current === BLOCK_POLICY) {
      $done({});
      return;
    }

    // 切到阻断策略
    await $policy.setSelectPolicy(POLICY_GROUP, BLOCK_POLICY);

    if (ENABLE_NOTIFY) {
      $notification.post(
        "Telegram 已打断连接",
        `策略组：${POLICY_GROUP}`,
        `→ ${BLOCK_POLICY}`
      );
    }

    // 等待 interrupt_duration
    await sleep(INTERRUPT_MS);

    // 切回恢复策略
    await $policy.setSelectPolicy(POLICY_GROUP, RECOVER_POLICY);

    if (ENABLE_NOTIFY) {
      $notification.post(
        "Telegram 连接已恢复",
        `策略组：${POLICY_GROUP}`,
        `→ ${RECOVER_POLICY}`
      );
    }

  } catch (e) {
    if (ENABLE_NOTIFY) {
      $notification.post(
        "Telegram 打断失败",
        "脚本异常",
        String(e)
      );
    }
  }

  $done({});
})();

/* ================== 工具函数 ================== */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
