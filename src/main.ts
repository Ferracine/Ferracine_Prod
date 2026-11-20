import '@fontsource-variable/inter';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { startApp } from './app';
import { byId } from './ui/dom';

startApp(byId('app'), window.localStorage);

// Service worker: guarda o app no aparelho para abrir sem internet e se atualiza sozinho.
// O estado (inclusive a OS em preenchimento) está salvo, então a recarga da atualização não perde nada.
registerSW({ immediate: true });
