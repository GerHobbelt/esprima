// test jison negative index reference variables recognition:
// `$-1` is expected to be parsed as an *expression*, while the others
// should parse as identifiers...
$$ = {
	val: $-1 + a.tx(`blub: ${$$-2} @ ${@@-3} vs. ${##-4}?`),
	loc: @-5,
	idx: #-6,
};