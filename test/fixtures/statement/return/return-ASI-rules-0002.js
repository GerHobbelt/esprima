// Because of ASI rules, these two lines will parse as separate statements.
function a() {
  return 
  `
  	test
  `;
}
