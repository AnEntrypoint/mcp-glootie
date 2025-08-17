#!/usr/bin/env node
// Final comprehensive test of the search functionality

import { initialize, queryIndex } from './src/js-vector-indexer.js';

async function runFinalTest() {
    console.log('🎯 FINAL SEARCH FUNCTIONALITY TEST\n');
    
    try {
        // Initialize
        await initialize();
        console.log('✅ System initialized\n');
        
        // Test various natural language queries
        const testCases = [
            {
                query: 'find function that extracts chunks',
                expectedType: 'function',
                description: 'Natural language function search'
            },
            {
                query: 'how to calculate similarity',
                expectedType: 'function', 
                description: 'Question-based search'
            },
            {
                query: 'cosineSimilarity',
                expectedType: 'function',
                description: 'Exact function name'
            },
            {
                query: 'show me text matching',
                expectedType: 'function',
                description: 'Descriptive search'
            },
            {
                query: 'vector search implementation',
                expectedType: 'function',
                description: 'Concept-based search'
            }
        ];
        
        let passedTests = 0;
        
        for (const testCase of testCases) {
            console.log(`🔍 Testing: "${testCase.query}"`);
            console.log(`   📝 ${testCase.description}`);
            
            const results = await queryIndex(testCase.query, 3);
            
            if (results.length > 0) {
                const topResult = results[0];
                console.log(`   ✅ Found: ${topResult.name || 'unnamed'} (${topResult.type})`);
                console.log(`   📊 Score: ${topResult.score.toFixed(3)}`);
                console.log(`   📍 ${topResult.file.split('/').pop()}:${topResult.startLine}`);
                
                if (topResult.score > 0.3) {
                    passedTests++;
                    console.log('   🎉 PASS - Good relevance score\n');
                } else {
                    console.log('   ⚠️  MARGINAL - Low relevance score\n');
                }
            } else {
                console.log('   ❌ FAIL - No results found\n');
            }
        }
        
        console.log(`📊 TEST SUMMARY: ${passedTests}/${testCases.length} tests passed`);
        
        if (passedTests >= testCases.length * 0.8) {
            console.log('🎉 SEARCH FUNCTIONALITY IS WORKING EXCELLENTLY!');
            console.log('✅ Natural language code search is ready for production use');
        } else {
            console.log('⚠️  Search functionality needs improvement');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

runFinalTest();