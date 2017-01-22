# Simple application installer

DESCRIPTION

The script is designed to simplify the process of installing applications in 
Windows OS. User selects the applications he needs, and then starts the 
installation process.

What should be done to make it all work

1. Download the setup program
2. Find out how to run the installation from the command line
	You should read the program documentation. If you have a piece of luck,
	you may find commands to install the application in so-called  "silent" 
	("unattended") mode, which requires no user actions.
3. Add the section \[Application\] (with options id, name, command) to the 
	configuration file
4. Run Simple application installer
5. Select you application
6. Click "install" button
5. Be happy

FILES

*  installer.js - Simple application installer  
*  installer.cfg - configuration file  
*  conditions\\*.js - scripts to test conditions  

REQUIREMENTS

Windows operating system
The script is written in jscript and uses Internet Explorer

(tested on WinXP SP3 + IE8)

CONFIGURATION

The configuration is stored in installer.cfg, which must be present in the same 
folder as the script is. Config consists of the sections, which include 
different options. Line can be commented with leading '#' character. 
  
Applications will be install is in the order they are written to a file.  
  
section [Options] contains general configuration options of the script  

options:  
*  default_template	- id of the template, which will be applied on the startup  
*  window_width	- window width  
*  window_height	- window height  
*  charset	- html page encoding  
*  log	- path to the log file  
*  row_height	- number of applications in a single column (so why row?)  
*  background_color	- background color  
*  wallpaper	- wallpaper  
*  title	- title  
  
section [Template] contains a template that determines which applications will be selected, you may have multiple such sections  
  
options:  
*  id 		(required) unique (once again: UNIQUE) template id
*  checked 	list of the application identifiers (separated by 
			commas, without spaces) to be selected

section [Application] describes the application, you may have multiple such
sections

options:
*  id - (required) unique (once again: A UNIQUE) application id
*  name - display name of the application
*  command - installation command (you may have several command 
			options)
*  requires - list of the identifiers of applications (separated by 
			commas, no spaces) that are needed for this application
*  conflicts - list of the identifiers of applications (separated by 
			commas, no spaces) that should not be installed with 
			this application
*  checkedif - condition (external program/script), which determines if the application should be selected regardless of template
*  uncheckedif - condition (external program/script), which determines 
			if the application should not be automatically selected
*  close_ie - close internet explorer before installation process is 
			started (value doesn't matter, it can be close_ie=true,
			for example), useful for installing some applications 
			like flashplayer

ENVIRONMENT

In the options log, command, checkedif, uncheckedif can use environment 
variables of the operating system, such as% temp%,% userprofile%, etc. 
You can also use variables 
*  %root% - path to the script.
*  %defaultuserprofile% - path to the default user profile
*  %defaultuserappdata% - path to the Application Data folder for default user profile
*  %programfiles_x86% - path to the x86 Program Files for amd64 OS 
				(for x86 OS this variable is the same as %ProgramFiles%)

LICENSE

This program is free software. It comes without any warranty, to
the extent permitted by applicable law. You can redistribute it
and/or modify it under the terms of the Do What The Fuck You Want
To Public License, Version 2, as published by Sam Hocevar. See
http://sam.zoy.org/wtfpl/COPYING for more details. 
