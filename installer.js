//************************************************
// File:	installer.js (automaticaly installs selected applications) 
// Author:	OlegL
// Homepage:	https://sourceforge.net/projects/simappi/
// Date:	2012.02.07
// Version:	0.01.0008
//
// This program is free software. It comes without any warranty, to
// the extent permitted by applicable law. You can redistribute it
// and/or modify it under the terms of the Do What The Fuck You Want
// To Public License, Version 2, as published by Sam Hocevar. See
// http://sam.zoy.org/wtfpl/COPYING for more details. 

var WshShell = WScript.CreateObject("WScript.Shell");
var FSO = WScript.CreateObject("Scripting.FileSystemObject");
var oIE ;
var GeneralOptions=WScript.CreateObject("Scripting.Dictionary");
var Applications=new Array();
var Templates=new Array();
var dApps=WScript.CreateObject("Scripting.Dictionary");
var dTempl=WScript.CreateObject("Scripting.Dictionary");
var dConflicts=WScript.CreateObject("Scripting.Dictionary");
var dInvDeps=WScript.CreateObject("Scripting.Dictionary"); // dInvDeps(id1).exists(id2) => id2 requires id1
var arConditionsChecked=new Array();
var arConditionsUnchecked=new Array();
var arDisablesCount=new Array(); // increase by 1 each time app is disabled, and decrease, when enabled
var OSVer=GetOSVer();
var optionType=WScript.CreateObject("Scripting.Dictionary");
optionType.Add("command","array");	//array = multiple options with similar name
optionType.Add("checked","list");	//list  = option with comma separated values
optionType.Add("requires","list");	//list  = option with comma separated values
optionType.Add("conflicts","list");	//list  = option with comma separated values
var dVariables=WScript.CreateObject("Scripting.Dictionary");
dVariables.Add("root",GetPath());
dVariables.Add("defaultuserprofile",GetDefaultUserProfile());

GeneralOptions.Add("window_width","800");
GeneralOptions.Add("window_height","600");
GeneralOptions.Add("charset","UTF-8");
GeneralOptions.Add("log","%temp%\\installer.log");
GeneralOptions.Add("default_template","default_template");
var logstring="";
var flLog=null;
var isTempLogFlushed=false;
var log2IEstring="";

//********************************************************


log("START installer");
log("OS: "+OSVer);

ReadOptions(GetPath()+"\\installer.cfg");
flLog=FSO.OpenTextFile(ReplaceVariables(GeneralOptions.Item("log")),8,1);
ReplaceAllVariables();
CheckConditions();

DrawForm();

var IEclosed = false;
var isChoiceMade = false;
while (!IEclosed && !isChoiceMade ) {WScript.Sleep(500)}  // Suspend 
if (isChoiceMade){
	Install();
}

Quit();

/////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////

//read options from file 
function ReadOptions(optionsPath){
	var str;
	var flOpt=FSO.OpenTextFile(optionsPath,1,1);
	var options=null;
	var section=null;
	while (!flOpt.AtEndOfStream){
		str=trim(flOpt.ReadLine());
		if (isLineCommented(str)) continue;
		if (isSectionLine(str)){
			section=str.toLowerCase();
			log("section found: "+section);
			if (section=="[options]"){
				log("general section");
				options=GeneralOptions;
			}
			else if (section=="[application]"){
				log("application section");
				Applications[Applications.length]=WScript.CreateObject("Scripting.Dictionary");
				options=Applications[Applications.length-1];
			}
			else if (section=="[template]"){
				log("template section");
				Templates[Templates.length]=WScript.CreateObject("Scripting.Dictionary");
				options=Templates[Templates.length-1];
			}
		}
		else if (isOptionLine(str)){
			if (options==null){
				log("WARNING: option without section: "+str+", ignoring");
				continue;
			}
			var option=ParseOption(str);
			var name=option.Item("name");
			var value=option.Item("value");
			log("option found:" +name+" ["+value+"]");
			//fill in apps or templates dictionary
			if (name=="id") {
				if (section=="[template]") {
					if (dTempl.Exists(value)) FatalError("Error! Duplicate id \""+value+"\"");
					dTempl.Add(value,options);
				}
				else if (section=="[application]"){
					if (dApps.Exists(value)) FatalError("Error! Duplicate id \""+value+"\"");
					dApps.Add(value,options);
				}
			}
			if (optionType.Item(name)=="array"){
				if (!options.Exists(name)) options.Add(name,new Array());
				options.Item(name).push(value);
			}
			else {
				if (options.Exists(name)) options.Remove(name);
				options.Add(name,value);
			}
		}
		//log(str);
	}
	flOpt.Close();
	CheckOptions();
	//заполним отдельный массив конфликтов (симметричный)
	for (i in Applications){
		var appid=Applications[i].Item("id");
		if (!dConflicts.Exists(appid))
			dConflicts.Add(appid,WScript.CreateObject("Scripting.Dictionary"));
		if (!Applications[i].Exists("conflicts")) continue;
		var arConf=Applications[i].Item("conflicts");
		for (j in arConf){
			if (!dConflicts.Exists(arConf[j]))
				dConflicts.Add(arConf[j],WScript.CreateObject("Scripting.Dictionary"));
			if (!dConflicts.Item(appid).Exists(arConf[j]))
				dConflicts.Item(appid).Add(arConf[j],true);
			if (!dConflicts.Item(arConf[j]).Exists(appid))
				dConflicts.Item(arConf[j]).Add(appid,true);
		}
	}
	//init dInvDeps
	for (var i in Applications){
		var appid=Applications[i].Item("id");
		if (Applications[i].Exists("requires")){
			var arReq=Applications[i].Item("requires");
			for (var j in arReq){
				if (!dInvDeps.Exists(arReq[j])) dInvDeps.Add(arReq[j],new Array());
				dInvDeps.Item(arReq[j]).push(appid);
			} 
		}
	}
	
	//init arDisablesCount
	for (i in Applications){
		var appid=Applications[i].Item("id");
		arDisablesCount[appid]=0;
	}
	
}

//check options for errors
function CheckOptions(){
	//check apps without id
	for (var i in Applications){
		
		if (!Applications[i].Exists("id")) FatalError("Error! Application without id ("+i+")!");
	}
}

//replace variables in the all commands with their values(variable is something surrounded with % signs)
function ReplaceAllVariables(){
	for (var i in Applications){
		if (Applications[i].Exists("command")){
			var commands=Applications[i].Item("command");
			log(Applications[i].Item("id")+" commands: "+commands.length);
			for (var j in commands){
				commands[j]=ReplaceVariables(commands[j]);
				log(commands[j]);
			}
		}
		if (Applications[i].Exists("checkedif")){
			Applications[i].Item("checkedif")=ReplaceVariables(Applications[i].Item("checkedif"));
		}
		if (Applications[i].Exists("uncheckedif")){
			Applications[i].Item("uncheckedif")=ReplaceVariables(Applications[i].Item("uncheckedif"));
		}
	}

}

//replace variables in a string with their value
function ReplaceVariables(str){
	var arVars=str.split('%');
	var flag_noreplace=false;
	while (arVars.length>2 && !flag_noreplace){
		flag_noreplace=true;
		for (var k=1;k<arVars.length-1;k++){
			var curvar=arVars[k];
			if (dVariables.Exists(curvar.toLowerCase())){
				str=str.replace("%"+curvar+"%",dVariables.Item(curvar.toLowerCase()));
				flag_noreplace=false;
				break;
			}

		}
		arVars=str.split('%');
	}
	return WshShell.ExpandEnvironmentStrings(str);	
}

function ParseOption(str){
	var name,value,result;
	name=str.substr(0,str.search(/=/));
	value=str.substr(str.search(/=/)+1);
	result=WScript.CreateObject("Scripting.Dictionary");
	result.Add("name",name);
	if (optionType.Item(name)=="list"){
		result.Add("value",value.split(","));
	}
	else result.Add("value",value);
	return result;
}

function isLineCommented(line){
	return (line.charAt(0)=='#');
}
function isSectionLine(line){
	return line.match(/\[.*\]/);
}
function isOptionLine(line){
	return line.match(/.+=.*/);
}

function DrawForm(){
	openIE();
	with (oIE){
		with (Document){
			writeln("<table border=0><tr><td valign=top align=centre>");
			writeln("<select name=\"template\" id=\"template\" >");
			for (i=0;i<Templates.length;i++){
				if (!Templates[i].Exists("id")) continue;
				writeln("<option value=\""+Templates[i].Item("id")+"\">"+Templates[i].Item("name")+"</option>");
			}
			writeln("</select><br><br>");
			writeln("<button id=but title='Install selected applications'> Install </button>") 
			writeln("</td><td valign=top>");
			for (i=0;i<Applications.length;i++){
				if (!Applications[i].Exists("id")) continue;
				var appid=Applications[i].Item("id");
				var appname=Applications[i].Item("name");
				var color="black";
				if (arConditionsChecked[appid]) color="blue";
				if (arConditionsUnchecked[appid]) color="grey";
				writeln("<input type=checkbox id="+appid+"><font color="+color+">"+appname+"</font><p>");
				if ( (i+1)%GeneralOptions.Item("row_height")==0 && i < (Applications.length-1) )
					writeln("</td><td valign=top>");
				all(appid).onclick = FormClickApp;
			}
			writeln("</td><tr></table>");
			writeln("</body></html>") 
			all.but.onclick = FormSubmit;
			all.template.onchange = FormTemplateChange;
		}
		FormApplyTemplate(Templates[0]);
	}
	
	
	WshShell.AppActivate("http");
	//while (oIE.Busy) {WScript.Sleep(200)}  // Suspend 
}

function openIE(writeLogBuffer){
	var sTitle="Simple application installer";
	oIE=WScript.CreateObject("InternetExplorer.Application", "IE_");
	with (oIE){
		Height = GeneralOptions.Item("window_height");
		Width = GeneralOptions.Item("window_width");
		MenuBar = 0;         // No menu
		ToolBar = 0;
		StatusBar = 0;
		navigate("about:blank");  // Load form.
		while (oIE.ReadyState<3) {WScript.Sleep(200)}
		var bgcolor="", wallpaper="";
		if (GeneralOptions.Exists("background_color")) 	bgcolor=" bgcolor="+GeneralOptions.Item("background_color")+" ";
		if (GeneralOptions.Exists("title")) 		sTitle=GeneralOptions.Item("title");
		if (GeneralOptions.Exists("wallpaper")) {
			var wallpaperUrl=GetPath().replace(/\\/g,"/")+"/"+GeneralOptions.Item("wallpaper").replace(/\\/,"/");
			wallpaper=" style=\" background: url('file://"+wallpaperUrl+"') no-repeat;\" ";
		}
	
		with (Document){
			writeln("<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">");
			writeln("<html xmlns=\"http://www.w3.org/1999/xhtml\"><head><meta http-equiv=\"Content-Type\" content=\"text/html; charset="+GeneralOptions.Item("charset")+"\" />")
			writeln("<title>" + sTitle +"</title></head><body "+bgcolor+wallpaper+" scroll=yes><center>") ;
			writeln("<h2>" + sTitle + "</h2></center>") 
			if (writeLogBuffer) writeln(log2IEstring);
		}
	}
	oIE.Visible=1;
	IEclosed=false;
}

function closeIE(){
	log2IE("closing IE");
	oIE.Quit();
	while (!IEclosed) WScript.Sleep(100);
	
}

function FormClickApp(){
	var appid=oIE.Document.activeElement.id;
	var checked=oIE.Document.activeElement.checked;
	if (checked){
		if (!tryCheckAppDeps(appid)) oIE.Document.all(appid).checked=false;
		else FormDisableConflicts(appid);
	}
	else {
		UncheckApp(appid);
	}
}

//uncheck app and all apps, dependent on it
function UncheckApp(appid){
	oIE.Document.all(appid).checked=false;
	FormEnableConflicts(appid);
	if (dInvDeps.Exists(appid)) {
		var arInvDeps=dInvDeps.Item(appid);
		for (var i in arInvDeps) UncheckApp(arInvDeps[i]);
	}
}

function tryCheckAppDeps(appid){
	log("tryCheckAppDeps "+appid);
	var deps=WScript.CreateObject("Scripting.Dictionary");
	if ( !getDeps(deps,appid) || hasConflicts(appid,deps)) return false;
	var arDeps=(new VBArray(deps.Keys())).toArray();
	
	for(var i in arDeps){
		var checked=FormIsAppChecked(arDeps[i]);
		if (!checked) {
			oIE.Document.all(arDeps[i]).checked=true;
			FormDisableConflicts(arDeps[i]);
		}
	}
	return true;
}

//enable checkboxes for conflicting applications 
//only if they are not conflicting with other applications
function FormEnableConflicts(appid){
	if (!dConflicts.Exists(appid)) return;
	for (var i in Applications) {
		var appid2=Applications[i].Item("id");
		if (dConflicts.Item(appid).Exists(appid2)){
			arDisablesCount[appid2]=Math.max(arDisablesCount[appid2]-1,0);
			if (arDisablesCount[appid2]==0) oIE.Document.all(appid2).disabled=false;
		}
	}
}

//disable checkboxes for conflicting applications 
function FormDisableConflicts(appid){
	log("disable conflicts "+appid);
	if (!dConflicts.Exists(appid)) return;
	for (var i in Applications) {
		var appid2=Applications[i].Item("id");
		if (dConflicts.Item(appid).Exists(appid2)){
			log("disable conflict: "+appid+" "+appid2);
			oIE.Document.all(appid2).disabled=true;
			arDisablesCount[appid2]++;
		}
	}
}

//get list of required apps for appid
// if there are conflicts, stops searching and returns false
function getDeps(dDeps,appid){
	log("getDeps start "+appid+": "+(new VBArray(dDeps.Keys())).toArray());
	var result=true;
	if (dDeps.Exists(appid)) return result;
	var app=dApps.Item(appid);
	for(i in app.Item("requires")){
		var req=app.Item("requires")[i];
		if (!FormIsAppEnabled(req)) result=false;
		else if (!FormIsAppChecked(req) && !arConditionsUnchecked[req]){
			result=result && getDeps(dDeps,req) && !hasConflicts(req,dDeps);
		}
		//log("requires " +req+" "+result+" "+FormIsAppEnabled(req));
		if (!result) break;
		else if (!arConditionsUnchecked[req] && !dDeps.Exists(req)) dDeps.Add(req,null);
	}	
	log("getDeps finish "+appid+": "+(new VBArray(dDeps.Keys())).toArray());
	return result;
}

function FormIsAppChecked(appid){
	return oIE.Document.all(appid).checked;
}

function FormIsAppEnabled(appid){
	return !oIE.Document.all(appid).disabled;
}

//check appid for conflicts with application list
function hasConflicts(appid,dAppList){
	var applist=(new VBArray(dAppList.Keys())).toArray();
	//log("hasConflicts "+appid+" "+applist);
	for (var i in applist){
		if (dConflicts.Item(appid).Exists(applist[i]))	return true;
	}
	
	return false;
}

function FormApplyTemplate(template){
	if (!template.Exists("checked")) return;
	log("applying template "+template.Item("id"));
	var id,app;
	var checked=template.Item("checked");
	var dChecked=WScript.CreateObject("Scripting.Dictionary");
	//clear checkboxes
	for (app in Applications){
		var appid=Applications[app].Item("id");
		oIE.Document.all(appid).checked=false;
		oIE.Document.all(appid).disabled=false;
		arDisablesCount[appid]=0;
	}
	
	for (id in checked) dChecked.Add(checked[id],true);
	// check/uncheck apps according to conditions
	for (app in Applications){
		var appid=Applications[app].Item("id");
		if (arConditionsChecked[appid] && !dChecked.Exists(appid)) dChecked.Add(appid,true);
		if (arConditionsUnchecked[appid] && dChecked.Exists(appid)) dChecked.Remove(appid);
	}
	for (app in Applications){
		var appid=Applications[app].Item("id");
		var disabled=oIE.Document.all(appid).disabled;
		var checked=FormIsAppChecked(appid);
		if(dChecked.Exists(appid) && !disabled && !checked && tryCheckAppDeps(appid)){
			oIE.Document.all(appid).checked=true;
			FormDisableConflicts(appid);
		}
	}
}

function FormSubmit(){
	isChoiceMade = true;
	//oIE.Quit();
}

function FormTemplateChange(a,b){
	var ind=oIE.Document.all.template.selectedIndex;
	var value=oIE.Document.all.template.options(ind).value;
	FormApplyTemplate(dTempl(value));
}

function IE_OnQuit()
{
    IEclosed = true;        // Indicate form is closed.
}

function CheckConditions(){
	log("checking conditions");
	var arCond=new Array(arConditionsChecked,arConditionsUnchecked);
	var arOption=new Array("checkedif","uncheckedif");
	for (var i in arOption){
		var opt=arOption[i];
		var cond=arCond[i];
		for (var j in Applications){
			var app=Applications[j];
			var res=false;
			if (!app.Exists(opt)) res=false;
			else {
				log(app.Item("id")+", checking condition: "+app.Item(opt));
				var retCode=0;
				try{
					retCode=WshShell.Run(app.Item(opt),4,true);
				}
				catch(e){
					log("ERROR!!! ("+e.number+") "+e.message);
				}
				log("condition returned: "+retCode+" ("+(retCode!=0)+")" );
				res=(retCode!=0);
			}
			cond[app.Item("id")]=res;
		}
	}
}

function Install(){
	var arApps2Install=new Array();
	for (var i in Applications){
		var appid=Applications[i].Item("id");
		if (oIE.Document.all(appid).checked) arApps2Install.push(appid);
	}
	oIE.navigate("about:blank");
	while (oIE.ReadyState<3) {WScript.Sleep(200)}
	log2IE("start install process");
	var errors=0;
	while(arApps2Install.length>0){
		var appid=arApps2Install.shift();
		var app=dApps.Item(appid);
		log2IE("application: "+app.Item("name"));
		var needToCloseIE=app.Exists("close_ie");
		if (needToCloseIE) closeIE();
		if (!app.Exists("command")) continue;
		var comm=app.Item("command");		
		for (var i in comm){
			log2IE("command: "+comm[i]);
			var retCode=WshShell.Run(comm[i],4,true);
			if (retCode!=0) {
				errors++;
				retStr=log2IE("result: ERROR("+retCode+")!!!","red");
			}
			else log2IE("result: ok");
		}
		if (IEclosed) openIE(true);
	}
	log2IE("finished install process");
	if (errors>0) log2IE("WARNING! Some commands were finished with error!","red");

	
}

function log(msg){
	var str;
	time=new Date();
	str=time.getFullYear()+".";
	str+=pad(time.getMonth()+1,2)+".";
	str+=pad(time.getDate(),2)+" ";
	str+=pad(time.getHours(),2)+":";
	str+=pad(time.getMinutes(),2)+":";
	str+=pad(time.getSeconds(),2)+" ";
	str+=msg;

	if (!isTempLogFlushed && flLog!=null){
		flLog.Write(logstring);
		isTempLogFlushed=true;
	}	

	if (isTempLogFlushed) flLog.WriteLine(str);
	else logstring+=str+"\n";
}

function log2IE(msgstr,msgcolor){
	log(msgstr);
	var str;
	time=new Date();
	str=time.getFullYear()+".";
	str+=pad(time.getMonth()+1,2)+".";
	str+=pad(time.getDate(),2)+" ";
	str+=pad(time.getHours(),2)+":";
	str+=pad(time.getMinutes(),2)+":";
	str+=pad(time.getSeconds(),2)+" ";
	str+=msgstr+"<br>\n";

	var color="black";
	if (msgcolor!=null) color=msgcolor;
	str="<font color="+color+">"+str+"</font>";
	log2IEstring+=str;
	if (!IEclosed) oIE.Document.writeln(str);
}

function FatalError(msg){
	log("FATAL: "+msg);
	WScript.Echo(msg);
	Quit();
}

function Quit(){
	log("EXIT");
	if (flLog!=null) flLog.Close();	
	WScript.Quit();
}

//returns path to the folder, where script is located
function GetPath()
{
    var path = WScript.ScriptFullName;
    path = path.substr(0, path.lastIndexOf("\\") );
    return path;
}

//returns path to the default user profile
function GetDefaultUserProfile(){
	if (OSVer > 5.1) {
		var profdir=WshShell.RegRead("HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProfileList\\Default");
		return WshShell.ExpandEnvironmentStrings(profdir);
	}
	else {
		var profpath=WshShell.RegRead("HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProfileList\\ProfilesDirectory");
		var profdir=WshShell.RegRead("HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProfileList\\DefaultUserProfile");
		return WshShell.ExpandEnvironmentStrings(profpath+"\\"+profdir);
	}
}

//get operation system version
function GetOSVer(){
	var regVer=WshShell.RegRead("HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\CurrentVersion");
	return parseFloat(regVer);
}

//add leading zeroes to a number
function pad(num, size) {
    var s = "0000000000000" + num;
    return s.substr(s.length-size);
}

//remove leading and trailing spaces
function trim(s) {
	return s.replace(/^\s+/,"").replace(/\s+$/,"");
}

//*** End