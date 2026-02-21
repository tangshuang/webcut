import { provide, inject, reactive, readonly } from 'vue';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

export interface ToastOptions {
    type?: ToastType;
    duration?: number;
}

export interface ToastState {
    visible: boolean;
    message: string;
    type: ToastType;
    duration: number;
}

const TOAST_INJECTION_KEY = 'WEBCUT_TOAST';

const DEFAULT_DURATION = 2000;

/**
 * Toast hook for displaying toast notifications
 *
 * Usage:
 * 1. Call useWebCutToast() in your root component to create the toast context
 * 2. Use the returned methods (success, error, info, show, hide) to control the toast
 * 3. Include the WebCutToast component in your root component template
 *
 * Example:
 * ```vue
 * <script setup>
 * const { success, error, info, show, hide, state } = useWebCutToast();
 * </script>
 *
 * <template>
 *   <WebCutToast
 *     :visible="state.visible"
 *     :message="state.message"
 *     :type="state.type"
 *   />
 *   <button @click="success('Operation successful!')">Show Toast</button>
 * </template>
 * ```
 */
export function useWebCutToast() {
    // Try to inject existing toast context
    const context = inject<ReturnType<typeof createToastContext> | null>(TOAST_INJECTION_KEY, null);
    if (!context) {
        throw new Error('useWebCutToast must be used within a WebCutProvider');
    }
    return context;
}

export function createToastContext() {
    const state = reactive<ToastState>({
        visible: false,
        message: '',
        type: 'info',
        duration: DEFAULT_DURATION,
    });

    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
    };

    /**
     * Show toast with custom options
     */
    const show = (message: string, options: ToastOptions = {}) => {
        clearTimer();

        const { type = 'info', duration = DEFAULT_DURATION } = options;

        state.message = message;
        state.type = type;
        state.duration = duration;
        state.visible = true;

        if (duration > 0) {
            hideTimer = setTimeout(() => {
                hide();
            }, duration);
        }
    };

    /**
     * Hide the toast
     */
    const hide = () => {
        clearTimer();
        state.visible = false;
    };

    /**
     * Show success toast
     */
    const success = (message: string, duration: number = DEFAULT_DURATION) => {
        show(message, { type: 'success', duration });
    };

    /**
     * Show error toast
     */
    const error = (message: string, duration: number = DEFAULT_DURATION) => {
        show(message, { type: 'error', duration });
    };

    /**
     * Show info toast
     */
    const info = (message: string, duration: number = DEFAULT_DURATION) => {
        show(message, { type: 'info', duration });
    };

    /**
     * Show loading toast
     */
    const loading = (message: string) => {
        show(message, { type: 'loading', duration: 0 });
    };

    return {
        state: readonly(state),
        show,
        hide,
        success,
        error,
        info,
        loading,
        // Provide function to re-provide in nested components if needed
        provide: () => provide(TOAST_INJECTION_KEY, { state: readonly(state), show, hide, success, error, info, loading }),
    };
}
