/**
 * Telegram Swiftgram 长连接打断脚本
 * subPolicies 是字符串子数组，先解析为 JS 数组
 */

const POLICY_GROUP = $argument.policyName || "Telegram";   // Telegram 策略组名称
const INTERRUPT_INTERVAL = $argument.INTERRUPT_INTETVAL || 30;     // 打断间隔（秒）
const ENABLE_NOTIFY = $argument.ENABLE_NOTIFY || true;        // 是否显示通知

const now = Math.floor(Date.now() / 1000);

// 读取上次打断时间
let last = $persistentStore.read("tg_policy_last_interrupt");
last = last ? parseInt(last) : 0;

if (now - last < INTERRUPT_INTERVAL) {
    console.log(`[TG] 跳过策略切换 (${now - last}s / ${INTERRUPT_INTERVAL}s)`);
    $done({});
} else {
    $persistentStore.write(String(now), "tg_policy_last_interrupt");

    const current = $config.getSelectedPolicy(POLICY_GROUP);

    $config.getSubPolicies(POLICY_GROUP, function(subPolicies) {
        if (!subPolicies) {
            console.log("[TG] 子策略为空，放行请求");
            $done({});
            return;
        }

        let policiesArray = [];
        try {
            // subPolicies 是 JSON 字符串，需要 parse
            if (typeof subPolicies === "string") {
                policiesArray = JSON.parse(subPolicies);
            } else if (Array.isArray(subPolicies)) {
                policiesArray = subPolicies;
            } else {
                console.log("[TG] 子策略格式不支持", subPolicies);
                $done({});
                return;
            }
        } catch (e) {
            console.log("[TG] JSON.parse 子策略失败", e);
            $done({});
            return;
        }

        // 找一个与当前不同的策略
        let alternate = null;
        for (let i = 0; i < policiesArray.length; i++) {
            const name = policiesArray[i].name;
            if (name && name !== current) {
                alternate = name;
                break;
            }
        }

        if (!alternate) {
            console.log("[TG] 无备用策略可切换，放行请求");
            $done({});
            return;
        }

        console.log(`[TG] 策略切换打断: ${current} → ${alternate} → ${current}`);

        // 发通知
        if (ENABLE_NOTIFY) {
            $notification.post(
                "Telegram 长连接已打断",
                "通过策略切换方式重置连接",
                `${current} → ${alternate} → ${current}`
            );
        }

        // 切换到备用策略
        $config.getConfig(POLICY_GROUP, alternate);

        // 0.3秒后切回原策略
        setTimeout(() => {
            $config.getConfig(POLICY_GROUP, current);
            $done();
        }, 300);
    });
}