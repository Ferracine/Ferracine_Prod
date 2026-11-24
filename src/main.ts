import '@fontsource-variable/inter';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { startApp } from './app';
import { androidBridge } from './platform';
import { initTheme } from './theme';
import { byId, CALLOUT, forceUppercase, h } from './ui/dom';
import { initUpdates } from './update';

forceUppercase();
initTheme(byId('theme-toggle'), byId('estilo-toggle'));
startApp(byId('app'), window.localStorage);
initUpdates();

// Endereço antigo (conta Bruno1991): o app mudou para a conta Ferracine. Este aviso sai quando o endereço antigo
// sair do ar (o PWA guarda os dados por endereço: as folhas daqui não passam para o novo).
if (location.hostname === 'bruno1991.github.io') {
  const novo = 'https://ferracine.github.io/Ferracine_Prod/';
  byId('update-banner').before(
    h(
      'div',
      { class: 'max-w-3xl w-full mx-auto px-4 pt-4', role: 'alert', 'data-testid': 'endereco-novo' },
      h(
        'div',
        { class: CALLOUT.warning },
        'Este endereço vai sair do ar. Use o novo: ',
        h('a', { href: novo, class: 'underline font-bold' }, novo),
        '. Antes de trocar, baixe os PDFs das últimas folhas: elas não passam para o endereço novo.',
      ),
    ),
  );
}

// Service worker (só no navegador/PWA): guarda o app no aparelho para abrir sem internet e se atualiza sozinho.
// O estado (inclusive a OS em preenchimento) está salvo, então a recarga da atualização não perde nada.
// No APK os arquivos já estão dentro do pacote: não há o que guardar nem atualizar pela rede.
if (!androidBridge) registerSW({ immediate: true });
