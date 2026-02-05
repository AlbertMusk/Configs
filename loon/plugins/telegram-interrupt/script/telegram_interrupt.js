/**
 * Telegram 智能前台打断（UI 参数驱动版）
 */

if ($argument === undefined) {
  $done({});
  return;
}

// ===== 参数读取 =====
const policyGroup = $argument.policy_group;
const blockPolicy = $argument.block_policy;
const recoverPolicy = $argument.recover_policy;

const interruptDuration = parseInt($argument.interrupt_duration, 10);
const lingerTime = parseInt($argument.linger_time, 10);
const sizeThreshold = parseInt($argument.size_threshold, 10);
const minInterval = parseInt($argument.min_interval, 10);

const enableNotify = String($argument.enable_notify) === "true";

// ===== 工具函数 =====
function notify(title, sub, msg) {
  if (enableNotify) {
    $notification.post(title, sub, msg);
  }
}

function isValidNumber(n, min, max) {
  return !isNaN(n) && n >= min && n <= max;
}

// ===== 参数校验 =====
if (
  !policyGroup ||
  !blockPolicy ||
  !recoverPolicy ||
  !isValidNumber(interruptDuration, 50, 3000) ||
  !isValidNumber(lingerTime, 200, 5000) ||
  !isValidNumber(sizeThreshold, 50, 5000) ||
  !isValidNumber(minInterval, 500, 10000)
) {
  notify(
    "Telegram 插件配置错误",
    "参数校验失败",
    "请检查插件参数设置"
  );
  $done({});
  return;
}

// ===== 智能前台判断 =====
const body = $response?.body || "";
const bodySize = body.length;

// 心跳包直接忽略
if (bodySize < sizeThreshold) {
  $done({});
  return;
}

// 防抖
const now = Date.now();
const lastTs = parseInt($persistentStore.read("last_interrupt_ts") || "0", 10);
if (now - lastTs < minInterval) {
  $done({});
  return;
}
$persistentStore.write(String(now), "last_interrupt_ts");

// ===== 执行策略切换 =====
(async () => {
  try {
    const current = await $policy.getSelectedPolicy(policyGroup);
    if (current === blockPolicy) {
      $done({});
      return;
    }

    await $policy.setSelectPolicy(policyGroup, blockPolicy);

    notify(
      "Telegram 已打断",
      policyGroup,
      `切换到 ${blockPolicy}`
    );

    setTimeout(async () => {
      await $policy.setSelectPolicy(policyGroup, recoverPolicy);

      notify(
        "Telegram 已恢复",
        policyGroup,
        `切换回 ${recoverPolicy}`
      );

      setTimeout(() => $done({}), lingerTime);
    }, interruptDuration);

  } catch (e) {
    notify("Telegram 打断失败", "", String(e));
    $done({});
  }
})();
