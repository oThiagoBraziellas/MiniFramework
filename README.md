# MiniFramework

Biblioteca de DOM virtual em cerca de 500 linhas: `h()`, `render`, algoritmo de diff e patch com filhos identificados por `key`, componentes de função e componentes com estado (`defineComponent` + `setState` agrupado em lote), ciclo de vida e referências (`ref`). Acompanha um app de demonstração feito com ela, que mostra em tempo real quantas operações de DOM cada atualização realizou.

Sem dependências e sem etapa de build.

## Por que este projeto

React, Vue e Preact partem da mesma ideia: descrever a interface como dados, comparar a descrição nova com a anterior e aplicar ao DOM só o que mudou. Construir isso do zero é um dos exercícios mais completos de front-end sênior, porque obriga a entender:

- por que listas precisam de `key` e o que acontece sem ela (o estado dos elementos fica preso à posição);
- o algoritmo de reordenação de filhos, incluindo a maior subsequência crescente (LIS) usada pelo Vue 3 para minimizar movimentos no DOM;
- como componentes com estado se encaixam em um renderizador, com atualizações em lote, ordem de renderização (pai antes do filho) e gatilhos de ciclo de vida;
- como testar um renderizador sem navegador, usando um DOM falso.

## Recursos

- `h(tipo, props, ...filhos)` com filhos aninhados em arrays, texto e valores vazios ignorados.
- `render(vnode, container)`: primeira chamada monta, as seguintes aplicam diff e patch.
- Props: atributos, `className`, `style` como objeto (diff chave a chave), propriedades de DOM (`value`, `checked`, `disabled`), atributos booleanos, `ref` e eventos (`onClick`, `onInput`, ...).
- Filhos com `key`: reordenar, inserir e remover reaproveita os nós existentes e usa o mínimo de movimentos.
- Componentes de função (`(props) => vnode`) e com estado (`defineComponent`), com `state`, `render`, `mounted`, `updated` e `unmounted`.
- `setState` aceita objeto ou função, é agrupado em lote (microtask) e ignora atualizações sem mudança.
- Contadores de operações (`stats`): nós criados, removidos, movidos e atualizações de props e texto.
- O renderizador recebe o `document` por parâmetro, o que permite testá-lo em Node com um DOM falso.

## Como executar

Abra o `index.html` no navegador ou use um servidor local:

```bash
python3 -m http.server 8000
# acesse http://localhost:8000
```

Se o navegador bloquear ES modules em `file://`, use o servidor local. No app, digite algo em uma linha, clique no contador dela e embaralhe a lista: com "use keys" ligado, o texto e o contador acompanham o item; desligado, ficam presos à posição.

Uso básico da biblioteca:

```js
import { h, defineComponent, createRenderer } from './src/index.js';

const Counter = defineComponent({
  state: () => ({ n: 0 }),
  render: ({ state, setState }) =>
    h('button', { onClick: () => setState((s) => ({ n: s.n + 1 })) }, `cliques: ${state.n}`),
});

createRenderer().render(h(Counter), document.body);
```

## Como testar

Dentro desta pasta, com Node 18 ou superior:

```bash
node --test
```

Os testes usam um DOM falso (`tests/helpers/fake-dom.js`) com serialização para HTML e contadores de operações. Cobrem:

- `lis-diff.test.js`: maior subsequência crescente (inclusive contra uma implementação de referência por força bruta em entradas aleatórias), pareamento de filhos com e sem `key`, chaves duplicadas, diff de props e de estilos;
- `vnode.test.js`: criação de vnodes, achatamento de filhos e validação de tipos;
- `renderer.test.js`: montagem, patch com reaproveitamento de nós, troca de tipo, eventos, `ref`, reordenação por chave (zero nós criados, `n - 1` movimentos ao inverter uma lista de `n`, um único movimento ao deslocar um item), uma sequência aleatória de 150 atualizações com listas cujas chaves entram e saem, e todo o ciclo de componentes (estado, lote, hooks, desmontagem, troca do elemento raiz, ordem pai antes do filho);
- `demo-model.test.js`: funções puras do app de demonstração.

## Decisões de projeto

- **Diff dos filhos em duas fases.** Primeiro `matchChildren` (função pura) decide quem reaproveita quem; depois o renderizador aplica. Separar as fases permite testar o algoritmo sem DOM e entender o que ele decide.
- **Reordenação com LIS.** Dos filhos que continuam existindo, a maior subsequência já em ordem relativa correta não precisa se mexer. Só os demais são movidos, percorrendo a lista de trás para frente para sempre ter um vizinho já final como referência. Inverter n itens move n − 1; mover um item move 1. O custo é O(n log n).
- **Sem `key`, casa por posição e tipo.** É o comportamento do React e o motivo de estado "trocar de lugar" em listas dinâmicas sem chave. Chaves duplicadas não quebram nada: a primeira reaproveita o nó, a segunda cria um novo.
- **Handlers com um único `addEventListener`.** Cada elemento registra um intermediário por tipo de evento, que chama sempre a função mais recente. Trocar `onClick` a cada render não gera `removeEventListener` nem `addEventListener`.
- **Componentes sem memoização.** Quando o pai renderiza, os filhos renderizam de novo (como o React por padrão). A otimização é fácil de adicionar (comparar props) e foi deixada de fora para manter o código curto.
- **Atualizações em lote por microtask.** Vários `setState` seguidos geram uma única renderização. As renderizações pendentes são ordenadas por profundidade para que o pai atualize antes do filho, e um filho já atualizado pelo pai não é renderizado duas vezes.
- **Estado imutável por convenção.** `setState` faz mescla rasa e compara com o valor anterior para evitar renderizações inúteis.
- **Hooks depois da inserção.** `mounted` e `updated` rodam depois que o DOM foi alterado, então `el.parentNode` já está correto.
- **Complexidade.** Patch de uma árvore: O(n) no número de nós. Filhos com chave: O(n log n) pela LIS e O(n) pelo mapeamento por chave.

## Estrutura de pastas

```
MiniFramework/
├── index.html
├── style.css
├── src/
│   ├── index.js       # API pública
│   ├── vnode.js       # h(), normalização de filhos
│   ├── diff.js        # pareamento de filhos, diff de props e estilos
│   ├── lis.js         # maior subsequência crescente
│   ├── component.js   # defineComponent
│   └── renderer.js    # montagem, patch, componentes e lote
├── demo/
│   ├── app.js         # app de demonstração
│   └── model.js       # funções puras da demonstração
├── tests/
│   ├── helpers/fake-dom.js
│   └── *.test.js
├── package.json
├── LICENSE
└── README.md
```

## Limitações conhecidas

- Não há fragmentos: um componente retorna um único vnode, e vários irmãos precisam de um elemento pai.
- Não há contexto, portais, hooks de função nem `shouldComponentUpdate`/memo.
- Eventos usam `addEventListener` diretamente, sem delegação nem sintéticos; nomes em camelCase (`onClick`) mapeiam para o evento em minúsculas, o que não cobre eventos com letras maiúsculas no nome.
- Não há SVG com namespace (`createElementNS`), então elementos SVG não renderizam corretamente.
- Não há renderização no servidor nem hidratação.
- Um mesmo objeto vnode não pode aparecer em dois lugares da árvore, porque a referência ao nó de DOM é guardada nele.
- O app de demonstração não tem testes automatizados; a biblioteca é testada com um DOM falso, não em um navegador real.

## Licença

MIT. Veja o arquivo [LICENSE](LICENSE).
