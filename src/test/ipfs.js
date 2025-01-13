import { create } from "ipfs-http-client";

class IPFSHealthChecker {
  constructor(apiUrl) {
    // Create an IPFS client instance
    this.client = create({ url: apiUrl });
  }

  // Check Node Identity
  async getNodeId() {
    try {
      const id = await this.client.id();
      console.log("Node ID:", id.id);
      console.log("Addresses:", id.addresses);
      return id;
    } catch (error) {
      console.error("Error fetching node identity:", error.message);
    }
  }

  // Check Connected Peers
  async getPeers() {
    try {
      const peers = await this.client.swarm.peers();
      console.log("Connected Peers:", peers);
      return peers;
    } catch (error) {
      console.error("Error fetching connected peers:", error.message);
    }
  }

  // Check Bandwidth Stats
  async getBandwidthStats() {
    try {
      const stats = await this.client.stats.bw();
      console.log("Bandwidth Stats:", stats);
      return stats;
    } catch (error) {
      console.error("Error fetching bandwidth stats:", error.message);
    }
  }

  // Check Repo Stats
  async getRepoStats() {
    try {
      const stats = await this.client.repo.stat();
      console.log("Repo Stats:", stats);
      return stats;
    } catch (error) {
      console.error("Error fetching repo stats:", error.message);
    }
  }

  // Resolve a CID
  async resolveCID(cid) {
    try {
      const content = [];
      for await (const chunk of this.client.cat(cid)) {
        content.push(new TextDecoder().decode(chunk));
      }
      console.log(`Content of CID ${cid}:`, content.join(""));
      return content.join("");
    } catch (error) {
      console.error(`Error resolving CID ${cid}:`, error.message);
    }
  }

  // Verify Pinned Content
  async listPins() {
    try {
      const pins = await this.client.pin.ls();
      console.log("Pinned CIDs:");
      for await (const pin of pins) {
        console.log(pin);
      }
    } catch (error) {
      console.error("Error fetching pinned CIDs:", error.message);
    }
  }
}

(async () => {
  const apiUrl = "http://ipfs-gateway.sentnl.io"; // Replace with your IPFS node API URL
  const checker = new IPFSHealthChecker(apiUrl);

  // Perform Health Checks
  await checker.getNodeId();
  await checker.getPeers();
  await checker.getBandwidthStats();
  await checker.getRepoStats();

  // Test CID (replace with an actual CID you want to check)
  const testCID = "QmWnfdZkwWJxabDUbimrtaweYF8u9TaESDBM8xvRxxbQxv";
  await checker.resolveCID(testCID);

  // List Pinned Content
  await checker.listPins();
})();