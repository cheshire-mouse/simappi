//check registry key existence
//usage:
//	reg_exists.js <regkey>
//example:
//	reg_exists.js "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\DefaultUserProfile"
//
//returns 	0 if key doesnt exist
//		1 if key exists

var WshShell=WScript.CreateObject("WScript.Shell");

if (WScript.Arguments.length==0) WScript.Quit(0);

var result=0;
try{
	WshShell.RegRead(WScript.Arguments(0));
	result=1;
}
catch(e){
	result=0;
}


WScript.Quit(result);