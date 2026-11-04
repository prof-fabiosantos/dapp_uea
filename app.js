// ============================================================
// 1) CONFIGURAÇÃO — cole aqui o endereço após o deploy no Remix
// ------------------------------------------------------------
// Para o frontend conversar com um contrato, o Web3.js precisa
// de duas informações:
//
//   CONTRACT_ADDRESS → ONDE o contrato está. É o endereço de 20
//     bytes (0x + 40 hex) gerado no deploy, exibido no Remix em
//     "Deployed Contracts". Cada deploy gera um endereço novo, e
//     ele só é válido na rede em que o contrato foi implantado
//     (o mesmo endereço na Mainnet ou em outra testnet aponta
//     para nada ou para outro contrato).
//
//   ABI (Application Binary Interface) → COMO falar com ele. É um
//     JSON gerado pelo compilador que descreve funções, parâmetros,
//     tipos de retorno, mutabilidade (view/nonpayable/payable) e
//     eventos. O Web3.js usa a ABI para codificar as chamadas em
//     bytes (seletor da função + argumentos) e decodificar as
//     respostas e os logs. O bytecode não é necessário aqui: ele
//     só importa no deploy.
//
// Se o contrato for alterado e reimplantado, atualize os dois:
// ABI desatualizada gera erros de decodificação ou chamadas a
// funções que não existem. Em projetos maiores, é comum importar
// a ABI de um arquivo JSON gerado pelo Hardhat/Foundry em vez de
// copiá-la à mão.
// ============================================================
const CONTRACT_ADDRESS = "0x3C074687b504D2bb104edB196148895cBa29142F";

// ABI: a "interface" do contrato (Remix > Solidity Compiler > ABI)
const ABI = [
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_mensagemInicial",
				"type": "string"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "autor",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "novaMensagem",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			}
		],
		"name": "MensagemAlterada",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_novaMensagem",
				"type": "string"
			}
		],
		"name": "setMensagem",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getMensagem",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "totalAlteracoes",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "ultimoAutor",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

// ============================================================
// 2) ESTADO E HELPERS
// ------------------------------------------------------------
// Estado global da aplicação, preenchido em conectar():
//   web3     → instância do Web3.js ligada ao provider da MetaMask
//              (window.ethereum). É por ela que o frontend fala
//              com a blockchain: consulta blocos, rede, contas etc.
//   contrato → objeto Contract criado a partir da ABI + endereço.
//              Expõe os métodos do Solidity em contrato.methods.*
//              (.call() para leitura, .send() para transações) e
//              os eventos em contrato.getPastEvents / .events.
//   conta    → endereço da carteira conectada (string 0x...).
//              É usado como "from" ao enviar transações, ou seja,
//              quem assina e paga o gas.
// Começam como undefined; até a conexão os botões de leitura e
// escrita ficam desabilitados para evitar chamadas sem provider.
//
// Funções auxiliares (helpers):
//   $(id)         → atalho para document.getElementById.
//   encurtar(end) → exibe endereços/hashes no formato 0x1234…abcd,
//                   mais legível na interface (o valor completo
//                   continua sendo usado internamente).
//   status(msg, tipo) → mostra mensagens de feedback ao usuário;
//                   tipo "ok" (verde), "erro" (vermelho) ou vazio
//                   (neutro), mapeado para classes CSS.
// ============================================================
let web3, contrato, conta;

const $ = (id) => document.getElementById(id);
const encurtar = (end) => `${end.slice(0, 6)}…${end.slice(-4)}`;

function status(msg, tipo = "") {
  $("status").textContent = msg;
  $("status").className = `status ${tipo}`;
}

// ============================================================
// 3) CONECTAR CARTEIRA (MetaMask injeta window.ethereum)
// ------------------------------------------------------------
// A MetaMask (e outras carteiras compatíveis com EIP-1193) injeta
// o objeto window.ethereum em toda página servida via HTTP/HTTPS.
// Ele é o "provider": a ponte entre o navegador e um nó da
// blockchain, além de guardar as chaves privadas do usuário —
// o frontend nunca vê a chave, só pede assinaturas.
//
// Passo a passo de conectar():
//   1. Verifica se window.ethereum existe (carteira instalada?).
//   2. Valida CONTRACT_ADDRESS com Web3.utils.isAddress, evitando
//      chamadas a um endereço inválido ou ainda não configurado.
//   3. eth_requestAccounts (EIP-1102) abre o popup da MetaMask
//      pedindo permissão; retorna a lista de contas autorizadas.
//      Se o usuário recusar, a Promise é rejeitada (código 4001).
//   4. Cria a instância Web3 sobre o provider e o objeto Contract
//      com ABI + endereço — a partir daqui contrato.methods.* existe.
//   5. getChainId identifica a rede (1 = Mainnet, 11155111 = Sepolia,
//      1337/31337 = redes locais). O contrato só funciona na rede
//      em que foi implantado.
//   6. Atualiza a interface, habilita os botões e carrega o estado
//      e o histórico do contrato.
// ============================================================
async function conectar() {
  if (!window.ethereum) {
    status("MetaMask não encontrada. Instale a extensão e recarregue.", "erro");
    return;
  }
  if (!web3Utils().isAddress(CONTRACT_ADDRESS)) {
    status("Configure CONTRACT_ADDRESS em app.js com o endereço do deploy.", "erro");
    return;
  }

  try {
    const contas = await window.ethereum.request({ method: "eth_requestAccounts" });
    conta = contas[0];

    web3 = new Web3(window.ethereum);
    contrato = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);

    const chainId = await web3.eth.getChainId();
    $("conta").textContent = encurtar(conta);
    $("rede").textContent = `Chain ID ${chainId}`;
    $("btnConectar").textContent = "Conectado";
    $("btnConectar").disabled = true;
    $("btnEnviar").disabled = false;
    $("btnAtualizar").disabled = false;

    await carregarEstado();
    await carregarHistorico();
    status("Carteira conectada.", "ok");
  } catch (err) {
    status(`Erro ao conectar: ${err.message}`, "erro");
  }
}

function web3Utils() {
  // Web3.utils está disponível mesmo antes de instanciar o provider
  return Web3.utils;
}

// ============================================================
// 4) LEITURA — .call() não gera transação nem custa gas
// ------------------------------------------------------------
// .call() executa a função localmente no nó (eth_call): o nó roda
// o código da EVM sobre o estado atual e devolve o resultado, sem
// criar transação, sem assinatura e sem alterar a blockchain.
// Por isso é gratuito e instantâneo — ideal para funções "view"
// e "pure" e para variáveis public (o Solidity gera um getter
// automático, como ultimoAutor() e totalAlteracoes()).
//
// Detalhes de carregarEstado():
//   - Promise.all dispara as três leituras em paralelo, reduzindo
//     a latência total para a da chamada mais lenta.
//   - Na v4 do Web3.js, uint256 volta como BigInt (precisão
//     arbitrária); usamos toString() para exibir. Nunca converter
//     valores grandes (ex.: saldos em wei) com Number() — perde
//     precisão acima de 2^53.
//   - Endereços voltam como string hexadecimal com checksum.
// ============================================================
async function carregarEstado() {
  const [msg, autor, total] = await Promise.all([
    contrato.methods.getMensagem().call(),
    contrato.methods.ultimoAutor().call(),
    contrato.methods.totalAlteracoes().call(), // retorna BigInt na v4
  ]);

  $("mensagem").textContent = msg;
  $("autor").textContent = encurtar(autor);
  $("total").textContent = total.toString();
}

// ============================================================
// 5) ESCRITA — .send() abre a MetaMask para assinar a transação
// ------------------------------------------------------------
// Alterar o estado do contrato exige uma transação: ela é
// assinada pela chave privada da conta, propagada na rede,
// incluída em um bloco pelos validadores e paga em gas.
//
// Ciclo de vida em enviarMensagem():
//   1. Validação local do texto (evita gastar gas com uma
//      transação que o require() do contrato rejeitaria).
//   2. .send({ from: conta }) — o Web3.js estima o gas, monta a
//      transação e pede à MetaMask que o usuário a assine.
//   3. Evento "transactionHash": a transação foi aceita no mempool
//      e já tem um hash (rastreável no Etherscan), mas AINDA NÃO
//      foi minerada.
//   4. A Promise resolve com o recibo (receipt) quando a transação
//      entra em um bloco: contém blockNumber, gasUsed, status e logs
//      (os eventos emitidos).
//   5. Recarregamos estado e histórico para refletir a mudança.
//
// Erros comuns capturados no catch:
//   - código 4001: usuário rejeitou a assinatura na MetaMask;
//   - revert: um require() falhou (ex.: "Mensagem vazia");
//   - saldo insuficiente para pagar o gas.
// O finally reabilita o botão em qualquer caso, impedindo
// envios duplicados enquanto a transação está pendente.
// ============================================================
async function enviarMensagem() {
  const texto = $("novaMensagem").value.trim();
  if (!texto) {
    status("Digite uma mensagem.", "erro");
    return;
  }

  $("btnEnviar").disabled = true;
  status("Aguardando assinatura na MetaMask…");

  try {
    const recibo = await contrato.methods
      .setMensagem(texto)
      .send({ from: conta })
      .on("transactionHash", (hash) =>
        status(`Transação enviada: ${encurtar(hash)} — aguardando mineração…`)
      );

    status(`Confirmada no bloco ${recibo.blockNumber}.`, "ok");
    $("novaMensagem").value = "";
    await carregarEstado();
    await carregarHistorico();
  } catch (err) {
    // Rejeição do usuário (code 4001) ou revert do require()
    status(`Falhou: ${err.message}`, "erro");
  } finally {
    $("btnEnviar").disabled = false;
  }
}

// ============================================================
// 6) EVENTOS — histórico lido dos logs da blockchain
// ------------------------------------------------------------
// Cada "emit MensagemAlterada(...)" no contrato grava um log no
// recibo da transação. Logs não ficam no storage do contrato
// (o contrato não consegue lê-los), mas são indexados pelos nós
// e consultáveis de fora — muito mais baratos que guardar um
// array on-chain. É o padrão para histórico e notificações.
//
// Detalhes de carregarHistorico():
//   - getBlockNumber devolve o bloco atual (BigInt, por isso 5000n).
//   - Consultamos só os últimos 5000 blocos: RPCs públicos e o da
//     MetaMask costumam limitar o intervalo de eth_getLogs; buscar
//     desde o bloco 0 pode falhar ou demorar.
//   - getPastEvents decodifica os logs usando a ABI e entrega os
//     argumentos em ev.returnValues (autor, novaMensagem, timestamp).
//   - Parâmetros "indexed" (como autor) viram topics e podem ser
//     filtrados: { filter: { autor: "0x..." } }.
//   - timestamp é block.timestamp em segundos (BigInt): convertemos
//     para milissegundos para o Date do JavaScript.
//   - Usamos textContent (e não innerHTML) porque a mensagem vem
//     de qualquer usuário: dados on-chain também são entrada não
//     confiável e poderiam conter HTML/JS malicioso (XSS).
// ============================================================
async function carregarHistorico() {
  const atual = await web3.eth.getBlockNumber(); // BigInt
  const janela = 5000n; // muitos RPCs limitam o intervalo de blocos
  const inicio = atual > janela ? atual - janela : 0n;

  const eventos = await contrato.getPastEvents("MensagemAlterada", {
    fromBlock: inicio,
    toBlock: "latest",
  });

  const lista = $("historico");
  lista.innerHTML = "";

  if (eventos.length === 0) {
    lista.innerHTML = '<li class="vazio">Nenhuma alteração nos blocos recentes.</li>';
    return;
  }

  eventos.reverse().forEach((ev) => {
    const { autor, novaMensagem, timestamp } = ev.returnValues;
    const data = new Date(Number(timestamp) * 1000).toLocaleString("pt-BR");

    const li = document.createElement("li");
    li.textContent = novaMensagem; // textContent evita injeção de HTML
    const meta = document.createElement("small");
    meta.textContent = `${encurtar(autor)} · ${data}`;
    li.appendChild(meta);
    lista.appendChild(li);
  });
}

// ============================================================
// 7) LIGAÇÕES DE UI E REAÇÃO A MUDANÇAS NA CARTEIRA
// ------------------------------------------------------------
// Associa os botões da página às funções acima via
// addEventListener (sem onclick inline no HTML, mantendo
// estrutura e comportamento separados).
//
// O provider EIP-1193 também emite eventos próprios:
//   - accountsChanged: o usuário trocou de conta ou desconectou
//     a dApp na MetaMask; a variável "conta" ficaria desatualizada
//     e as próximas transações sairiam da conta errada.
//   - chainChanged: o usuário mudou de rede; o endereço do
//     contrato provavelmente não existe na nova rede.
// Nos dois casos, recarregar a página é a estratégia mais simples
// e segura (recomendada pela própria MetaMask): todo o estado é
// recriado do zero. Numa dApp maior, poderíamos apenas atualizar
// as variáveis e a interface sem reload.
// ============================================================
$("btnConectar").addEventListener("click", conectar);
$("btnEnviar").addEventListener("click", enviarMensagem);
$("btnAtualizar").addEventListener("click", async () => {
  await carregarEstado();
  await carregarHistorico();
  status("Dados atualizados.", "ok");
});

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}
