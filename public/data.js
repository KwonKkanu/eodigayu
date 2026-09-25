/* Fictional routes. Real place names do not imply verified transit service. */
(function(root){
  const routes=[
    {id:'A',bus:'825',minutes:25,wait:5,stops:[['대전대학교','Daejeon University'],['시연 정류장 A','Demo stop A'],['시연 정류장 B','Demo stop B'],['시연 정류장 C','Demo stop C'],['대전역','Daejeon Station']]},
    {id:'B',bus:'826',minutes:32,wait:8,stops:[['대전대학교','Daejeon University'],['시연 정류장 D','Demo stop D'],['시연 정류장 E','Demo stop E'],['시연 정류장 F','Demo stop F'],['시연 정류장 G','Demo stop G'],['대전역','Daejeon Station']]}
  ];
  if(typeof module!=='undefined')module.exports=routes;else root.DEMO_ROUTES=routes;
})(typeof window!=='undefined'?window:globalThis);
