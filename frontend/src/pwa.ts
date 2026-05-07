import { registerSW } from "virtual:pwa-register";

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{
        outcome: "accepted" | "dismissed";
        platform: string;
    }>;
};

function isStandaloneMode(): boolean {
    const navigatorWithStandalone = navigator as Navigator & {
        standalone?: boolean;
    };

    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        navigatorWithStandalone.standalone === true
    );
}

export function setupPwa(): void {
    registerSW({
        immediate: true,
    });

    const installButton = document.getElementById("install-btn");
    if (!(installButton instanceof HTMLButtonElement)) {
        return;
    }

    let deferredPrompt: BeforeInstallPromptEvent | null = null;

    const hideButton = (): void => {
        installButton.hidden = true;
        installButton.disabled = false;
    };

    if (isStandaloneMode()) {
        hideButton();
    }

    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredPrompt = event as BeforeInstallPromptEvent;
        installButton.hidden = false;
    });

    installButton.addEventListener("click", async () => {
        if (!deferredPrompt) {
            return;
        }

        installButton.disabled = true;
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;

        if (choice.outcome === "accepted") {
            deferredPrompt = null;
            hideButton();
            return;
        }

        installButton.disabled = false;
    });

    window.addEventListener("appinstalled", () => {
        deferredPrompt = null;
        hideButton();
    });
}
