/// <reference lib="dom" />
// The only preload. It is attached to the chrome, the overlay and every tab,
// and exposes an API only when the document is Auralis' own:
//   auralis://chrome, auralis://overlay  → their UI method lists
//   auralis://<internal page>            → that page's method list
// On any web origin it exposes nothing. The main process independently
// re-verifies the sender of every call.
import { PAGE_METHODS, ROLE_METHODS } from '../shared/ipc'
import { INTERNAL_PAGES, type InternalPage } from '../shared/url'
import { exposeBridge } from './bridge'

const host = location.hostname
if (location.protocol === 'auralis:' && window.top === window) {
  if (host === 'chrome' || host === 'overlay') exposeBridge(ROLE_METHODS[host])
  else if ((INTERNAL_PAGES as readonly string[]).includes(host)) exposeBridge(PAGE_METHODS[host as InternalPage])
}
