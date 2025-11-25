try {
    const langchain = require('langchain');
    console.log('Keys in langchain:', Object.keys(langchain));
} catch (e) {
    console.error('Error requiring langchain:', e.message);
}

try {
    const memory = require('langchain/memory');
    console.log('Keys in langchain/memory:', Object.keys(memory));
} catch (e) {
    console.error('Error requiring langchain/memory:', e.message);
}


try {
    const memory = require('@langchain/core/memory');
    console.log('Keys in @langchain/core/memory:', Object.keys(memory));
} catch (e) {
    console.error('Error requiring @langchain/core/memory:', e.message);
}

try {
    const community = require('@langchain/community');
    console.log('Keys in @langchain/community:', Object.keys(community));
} catch (e) {
    console.error('Error requiring @langchain/community:', e.message);
}
