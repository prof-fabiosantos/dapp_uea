// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Mural de Mensagens
/// @notice Exemplo didático: guarda uma mensagem pública que qualquer
///         carteira pode alterar. Cada alteração emite um evento.
contract MuralDeMensagens {
    // Estado armazenado na blockchain
    string private mensagem;
    address public ultimoAutor;
    uint256 public totalAlteracoes;

    // Eventos ficam registrados nos logs da transação e podem ser
    // consultados pelo frontend (histórico barato, sem gastar storage)
    event MensagemAlterada(
        address indexed autor,
        string novaMensagem,
        uint256 timestamp
    );

    constructor(string memory _mensagemInicial) {
        mensagem = _mensagemInicial;
        ultimoAutor = msg.sender;
    }

    /// @notice Altera a mensagem (transação: custa gas)
    function setMensagem(string calldata _novaMensagem) external {
        require(bytes(_novaMensagem).length > 0, "Mensagem vazia");
        require(bytes(_novaMensagem).length <= 280, "Maximo de 280 bytes");

        mensagem = _novaMensagem;
        ultimoAutor = msg.sender;
        totalAlteracoes++;

        emit MensagemAlterada(msg.sender, _novaMensagem, block.timestamp);
    }

    /// @notice Lê a mensagem atual (chamada view: gratuita)
    function getMensagem() external view returns (string memory) {
        return mensagem;
    }
}
