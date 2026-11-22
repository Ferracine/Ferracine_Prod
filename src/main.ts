import '@fontsource-variable/inter';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { startApp } from './app';
import { androidBridge } from './platform';
import { initTheme } from './theme';
import { byId, forceUppercase } from './ui/dom';
import { initUpdates } from './update';

forceUppercase();
initTheme(byId('theme-toggle'));
startApp(byId('app'), window.localStorage);
initUpdates();

// Service worker (só no navegador/PWA): guarda o app no aparelho para abrir sem internet e se atualiza sozinho.
// O estado (inclusive a OS em preenchimento) está salvo, então a recarga da atualização não perde nada.
// No APK os arquivos já estão dentro do pacote: não há o que guardar nem atualizar pela rede.
if (!androidBridge) registerSW({ immediate: true });
