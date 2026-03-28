// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title KouohNFT
/// @notice お香購入証明NFT（古都の香り 空蝉シリーズ）
/// @dev GoshuinNFT.sol ベース。mintNFT(address, string) でミント。
contract KouohNFT is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    event Minted(address indexed recipient, uint256 indexed tokenId, string tokenURI);

    constructor() ERC721("KouohNFT", "KOUOH") Ownable(msg.sender) {
        _tokenIdCounter = 0;
    }

    /// @notice 購入証明NFTをミントする
    /// @param recipient NFTの受け取りアドレス（Privyが生成したウォレット）
    /// @param tokenURI  メタデータURL（/api/metadata?...）
    /// @return 発行されたtokenId
    function mintNFT(address recipient, string memory tokenURI)
        public
        onlyOwner
        returns (uint256)
    {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter += 1;

        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, tokenURI);

        emit Minted(recipient, tokenId, tokenURI);
        return tokenId;
    }

    /// @notice 現在の発行済みトークン数
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }
}
