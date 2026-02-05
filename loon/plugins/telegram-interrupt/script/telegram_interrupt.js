/**
 * Telegram 智能打断脚本
 * 仅在检测到新消息迹象时触发
 */

const policyGroup = $argument.policy_group || "Telegram";
const blockPolicy = $argument.block_policy || "DIRECT";
const recoverPolicy = $argument.recover_policy || "Proxy";

const interruptDuration = parseInt($argument.interrupt_duration || "300", 10);
const lingerTime = parseInt($argument.linger_time || "1500", 10);
const enableNotify = ($argument.enable_notify || "0") === "1";

// 智能判断参数
const sizeThreshold = parseInt($argument.size_threshold || "300", 10); // 字节
const minInterval = parseInt($argument.min_interval || "2000", 10); // ms

const now = Date.now();
const lastTs = parseInt($persistentStore.read("last_interrupt_ts") || "0", 10);

// ===== 1️⃣ 判断是否需要处理 =====

// response-body 脚本可直接读取 $response.body
const body = $response?.body || "";
const bodySize = body.length;

// 太小 → 心跳包，直接放行
if (bodySize < sizeThreshold) {
  $done({});
  return;
}

// 防止短时间内重复触发
if (now - lastTs < minInterval) {
  $done({});
  return;
}

// ===== 2️⃣ 满足“疑似新消息”条件 =====
$persistentStore.write(String(now), "last_interrupt_ts");

(async () => {
  try {
    const currentPolicy = await $policy.getSelectedPolicy(policyGroup);
    if (currentPolicy === blockPolicy) {
      $done({});
      return;
    }

    await $policy.setSelectPolicy(policyGroup, blockPolicy);

    if (enableNotify) {
      $notification.post(
        "Telegram 检测到新消息",
        "已执行智能打断",
        `响应体大小：${bodySize} bytes`
      );
    }

    setTimeout(async () => {
      await $policy.setSelectPolicy(policyGroup, recoverPolicy);

      if (enableNotify) {
        $notification.post(
          "Telegram 连接已恢复",
          policyGroup,
          recoverPolicy
        );
      }

      setTimeout(() => $done({}), lingerTime);
    }, interruptDuration);

  } catch (e) {
    if (enableNotify) {
      $notification.post("Telegram 智能打断失败", "", String(e));
    }
    $done({});
  }
})();
