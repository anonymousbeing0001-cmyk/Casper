// web-learner.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { JSDOM } = require('jsdom');

const memoryFile = path.join(__dirname, 'ai_memory.json');
const seedFile = path.join(__dirname, 'seed_urls.json');

// Load Casper memory
let AI_coreMemory = fs.existsSync(memoryFile)
    ? JSON.parse(fs.readFileSync(memoryFile))
    : {
        contextMemory: [],
        longTerm: {
            summary: "Casper starts with foundational knowledge in AI, programming, memory management, and reasoning.",
            topics: {
                "AI": 1,
                "Programming": 1,
                "Web Crawling": 1,
                "Memory Management": 1,
                "Natural Language Understanding": 1,
                "Knowledge Graphs": 1,
                "Reasoning": 1,
                "Self-Improvement": 1,
                "Fact Verification": 1,
                "Trust Scoring": 1
            },
            patches: [],
            suggestions: [],
            knowledgeBase: []
        }
    };

// Load seed URLs
let seedUrls = fs.existsSync(seedFile) ? JSON.parse(fs.readFileSync(seedFile)).seedUrls : [
    "https://en.wikipedia.org/wiki/Artificial_intelligence",
    "https://en.wikipedia.org/wiki/Machine_learning",
    "https://en.wikipedia.org/wiki/Natural_language_processing",
    "https://stackoverflow.com",
    "https://github.com",
    "https://developer.mozilla.org",
    "https://arxiv.org",
    "https://bbc.com/news",
    "https://openai.com/blog",
    "https://www.khanacademy.org"
];

// Configuration
const MAX_CRAWL_DEPTH = 2;
const MAX_LINKS_PER_PAGE = 10;
const THROTTLE_MS = 1000;
const WHITELIST_DOMAINS = [
    'wikipedia.org',
    'stackoverflow.com',
    'github.com',
    'bbc.com',
    'developer.mozilla.org',
    'arxiv.org',
    'openai.com',
    'khanacademy.org'
];

// Save memory
function saveMemory() {
    fs.writeFileSync(memoryFile, JSON.stringify(AI_coreMemory, null, 2));
}

// Extract links from a page
function extractLinks(dom, baseUrl) {
    const anchors = [...dom.window.document.querySelectorAll('a[href]')];
    let links = anchors.map(a => new URL(a.href, baseUrl).href);
    links = links.filter(l => WHITELIST_DOMAINS.some(d => l.includes(d)));
    return links.slice(0, MAX_LINKS_PER_PAGE);
}

// Extract meaningful text
function extractText(dom) {
    const paragraphs = [...dom.window.document.querySelectorAll('p')];
    return paragraphs.map(p => p.textContent.trim()).filter(t => t.length > 50);
}

// Recursive crawler
async function crawl(url, depth = 0, visited = new Set()) {
    if (depth > MAX_CRAWL_DEPTH || visited.has(url)) return;
    visited.add(url);

    try {
        console.log('Crawling:', url);
        const response = await axios.get(url);
        const dom = new JSDOM(response.data);

        const texts = extractText(dom);
        texts.forEach(text => {
            if (!AI_coreMemory.longTerm.knowledgeBase.some(k => k.text === text)) {
                AI_coreMemory.longTerm.knowledgeBase.push({
                    text,
                    source: url,
                    timestamp: Date.now(),
                    trustScore: 1.0,
                    verified: false
                });
            }
        });
        saveMemory();

        const links = extractLinks(dom, url);
        for (const link of links) {
            await new Promise(r => setTimeout(r, THROTTLE_MS));
            setImmediate(() => crawl(link, depth + 1, visited));
        }
    } catch (e) {
        console.log('Failed to crawl', url, e.message);
    }
}

// Start crawling all seed URLs
function startLearning() {
    console.log('Casper: Starting web learning...');
    seedUrls.forEach(url => setImmediate(() => crawl(url)));
}

// Export for server.js or manual start
module.exports = { startLearning };

// Auto-start if run directly
if (require.main === module) {
    startLearning();
}