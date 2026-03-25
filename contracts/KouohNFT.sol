// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24; // ここを 0.8.24 に変更

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract KouohNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    // NFTの属性を記録する構造体
    struct PurchaseInfo {
        string brandName; // お香ブランド名
        string scentType; // 香りの種類（例：白檀、沈香）
        uint256 purchaseDate; // 購入日
    }

    mapping(uint256 => PurchaseInfo) public purchaseRecords;

    constructor() ERC721("Kouoh Experience NFT", "KOUOH") Ownable(msg.sender) {}

    // Mint関数（バックエンドの秘密鍵から実行）
    function safeMint(
        address to, 
        string memory uri, 
        string memory _brandName, 
        string memory _scentType
    ) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        // 購入情報を記録
        purchaseRecords[tokenId] = PurchaseInfo({
            brandName: _brandName,
            scentType: _scentType,
            purchaseDate: block.timestamp
        });
    }

    // 購入情報を取得する関数
    function getPurchaseInfo(uint256 tokenId) public view returns (PurchaseInfo memory) {
        _requireOwned(tokenId);
        return purchaseRecords[tokenId];
    }
}