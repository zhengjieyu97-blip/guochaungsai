import { ref } from 'vue'

export type ToastTone = 'success' | 'warning' | 'error' | 'info'
export interface ToastItem { id: number; message: string; tone: ToastTone }

const toasts = ref<ToastItem[]>([])
let sequence = 0

export function useToast() {
  function push(message: string, tone: ToastTone = 'success') {
    const id = ++sequence
    toasts.value.push({ id, message, tone })
    window.setTimeout(() => {
      toasts.value = toasts.value.filter((toast) => toast.id !== id)
    }, 3600)
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }
  return { toasts, push, dismiss }
}
