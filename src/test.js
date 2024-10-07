import NodePulse from '@sentnl/nodepulse';

const nodePulse = new NodePulse();

async function example() {
  try {

    const node = await nodePulse.getNode();
    console.log('Using node:', node);
    
    const response = await fetch(`${node}/v1/chain/get_info`);
    const chainInfo = await response.json();
    console.log('Chain info:', chainInfo);
  } catch (error) {
    console.error('Failed to get chain info:', error.message);
  }
}

example();