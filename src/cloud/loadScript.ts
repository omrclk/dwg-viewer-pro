const loaded = new Set<string>()

export function loadScript(src: string, id?: string): Promise<void> {
  if (id && loaded.has(id)) return Promise.resolve()
  if (document.querySelector(`script[src="${src}"]`)) {
    if (id) loaded.add(id)
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    if (id) script.id = id
    script.onload = () => {
      if (id) loaded.add(id)
      resolve()
    }
    script.onerror = () => reject(new Error(`Script yuklenemedi: ${src}`))
    document.head.appendChild(script)
  })
}
