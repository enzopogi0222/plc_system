<?php 
header('Access-Control-Allow-Origin: *');
$sw=$_REQUEST['s1'];
$st=$_REQUEST['s2'];
$ip =$_REQUEST['ip'];
$pt =0;//$_REQUEST['pt'];
if ($sw=='1' and $st=='ON') {$msg='11'; }if ($sw=='1' and $st=='OFF') {$msg='21'; }
if ($sw=='2' and $st=='ON') {$msg='12'; }if ($sw=='2' and $st=='OFF') {$msg='22'; }
if ($sw=='X' and $st=='ON') {$msg='1X'; } //all on
if ($sw=='X' and $st=='OFF') {$msg='2X'; } //all off
$msgx=$msg ;//."*";
if($pt==0){  $sock=socket_create(AF_INET, SOCK_STREAM, SOL_TCP);  $fp = fsockopen($ip,6722, $errno, $errstr, 30);  fwrite($fp, $msg); fwrite($fp, "00"); echo fread($fp, 2);usleep(5000); } 
if($pt==1){    $sock = socket_create(AF_INET, SOCK_DGRAM, SOL_UDP);$fp=socket_sendto($sock, $msg, strlen($msg), 0, $ip,6723); socket_close($sock); usleep(5000);
}
?> 