
const k = 'AQ.Ab8RN6J86krCvLMSrzdExjPxhU_T_DTEF-EOMzlWYSJK6UDmEw';
const sp = 'ÃäÊ ÇáãÓÇÚÏ ÇáÐßí (ÇáÈæÕáÉ) Ýí ãäÕÉ ÇáÃÓÊÇÐ íæÓÝ ÈÑßÇÊ áÊÚáíã ÇáÊÇÑíÎ æÇáÌÛÑÇÝíÇ ááËÇäæíÉ ÇáÚÇãÉ æÇáÅÚÏÇÏíÉ ÈãÕÑ. ÃÌÈ ÈÔßá ãÈÇÔÑ æÚáãí æãÎÊÕÑ æãÈÓØ. áÇ ÊÓÃá ÇáØÇáÈ ÚãÇ íÞÕÏå Èá ÇÔÑÍ ÇáãÚáæãÉ ÝæÑÇð. Êßáã ÈáØÝ æÊÔÌíÚ.';
const msg = 'ãíä åæ ÇÓãÇÚíá ÈÇÔÇ';
fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='+k, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
        system_instruction:{parts:[{text:sp}]},
        contents:[{role:'user',parts:[{text:msg}]}],
        generationConfig:{temperature:0.2,maxOutputTokens:300}
    })
}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d, null, 2))).catch(e=>console.error(e));

