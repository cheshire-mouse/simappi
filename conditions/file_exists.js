//check file existence
//usage:
//	file_exists.js <filename>
//
//returns 	0 if file doesnt exist
//		1 if file exists

var fso=WScript.CreateObject("Scripting.FileSystemObject");

var retCode=(WScript.Arguments.length>0 && fso.FileExists(WScript.Arguments(0)) ) ? 1 : 0;


WScript.Quit(retCode);