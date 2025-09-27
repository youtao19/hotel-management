import { defineBoot } from '#q-app/wrappers'
import { createPinia } from 'pinia'
import piniaPersistedstate from 'pinia-plugin-persistedstate'

export default defineBoot(({ app }) => {
  const pinia = createPinia()
  pinia.use(piniaPersistedstate)
  app.use(pinia)
})
