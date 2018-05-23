// This one is expected to fail due to ASI kicking in. Compare with the 'fixtures/statement/return/return-ASI-rules-*' tests.

__proto__: while (true) { 
	break 
		__proto__; 
}