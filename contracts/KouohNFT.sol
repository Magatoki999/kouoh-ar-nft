// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title KouohNFT
 * @dev お香購入証明NFT（ERC-721）
 *      GoshuinNFT.sol（goshuin-ar-hounou）をベースに
 *      「参拝証明」→「購入証明」へ改変
 *
 * MAGATOKI Laboratory
 */
contract KouohNFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // 購入証明発行イベント
    event PurchaseCertified(
        address indexed to,
        uint256 indexed tokenId,
        string certificateId,
        string productName
    );

    constructor() ERC721("KouohNFT", "KOUOH") Ownable(msg.sender) {}

    /**
     * @dev 購入証明NFTをミント
     * @param to          受取ウォレットアドレス
     * @param tokenURI_   IPFSメタデータURI
     * @param certificateId  証明書ID（例: PURCHASE-ABC123）
     * @param productName    商品名
     */
    function mintPurchaseCertificate(
        address to,
        string memory tokenURI_,
        string memory certificateId,
        string memory productName
    ) public onlyOwner returns (uint256) {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        _mint(to, newTokenId);
        _setTokenURI(newTokenId, tokenURI_);

        emit PurchaseCertified(to, newTokenId, certificateId, productName);

        return newTokenId;
    }

    /**
     * @dev 現在の総発行数を返す
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIds.current();
    }
}
