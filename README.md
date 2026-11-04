# Mural de Mensagens — dApp de exemplo

Contrato Solidity + frontend em HTML/CSS/JavaScript com Web3.js v4.

```
MuralDeMensagens.sol   contrato inteligente
index.html             interface
style.css              estilos
app.js                 integração Web3.js (conectar, ler, escrever, eventos)
```

## Pré-requisitos
- Extensão **MetaMask** no navegador
- ETH de teste na rede **Sepolia** (faucet) — ou uma rede local (Ganache/Hardhat/Anvil)

## 1. Deploy do contrato (Remix)
1. Abra https://remix.ethereum.org e crie `MuralDeMensagens.sol` com o conteúdo do arquivo.
2. Aba **Solidity Compiler** → versão `0.8.20` ou superior → **Compile**.
3. Aba **Deploy & Run** → Environment: **Injected Provider - MetaMask** (rede Sepolia).
   > Não use "Remix VM": essa blockchain existe só dentro do Remix e o frontend não a enxerga.
4. Preencha `_mensagemInicial` (ex.: `"Ola, blockchain!"`) → **Deploy** → confirme na MetaMask.
5. Copie o endereço do contrato implantado.

## 2. Configurar o frontend
Em `app.js`, substitua:
```js
const CONTRACT_ADDRESS = "0xCOLE_O_ENDERECO_DO_CONTRATO_AQUI";
```
Se alterar o contrato, copie a nova ABI no Remix (Compiler → ABI) e atualize a constante `ABI`.

## 3. Rodar
A MetaMask não injeta `window.ethereum` em páginas `file://`, então sirva via HTTP:
```bash
npx serve .
# ou
python -m http.server 8000
```
Abra `http://localhost:8000` (ou a porta indicada), clique em **Conectar MetaMask** e teste.

## Conceitos demonstrados
| Conceito | Onde |
|---|---|
| Estado on-chain, `view`, `require`, eventos | `MuralDeMensagens.sol` |
| Provider injetado (`window.ethereum`) | `conectar()` |
| Leitura gratuita com `.call()` | `carregarEstado()` |
| Transação assinada com `.send()` | `enviarMensagem()` |
| Consulta de logs com `getPastEvents` | `carregarHistorico()` |
| Reação a troca de conta/rede | final de `app.js` |

## Exercícios sugeridos
1. Cobrar uma taxa (`payable`) para escrever no mural e adicionar `sacar()` com `onlyOwner`.
2. Guardar todas as mensagens num `array` de `struct` e comparar o custo de gas com o uso de eventos.
3. Atualizar o histórico em tempo real com `contrato.events.MensagemAlterada()` usando um provider WebSocket.
