'use client'

import { useState } from 'react'

export default function Calculator(){

const [value,setValue]=useState('')

function add(v:string){
setValue(prev=>prev+v)
}

function clear(){
setValue('')
}

function calc(){
try{
const r=eval(value.replace('^','**'))
setValue(String(r))
}catch{
setValue('Error')
}
}

return(

<div className="fixed bottom-6 right-6 w-72 bg-white border rounded-2xl shadow-xl p-4">

<input
value={value}
readOnly
className="w-full border rounded-lg px-3 py-2 mb-3 text-right"
/>

<div className="grid grid-cols-4 gap-2">

{['7','8','9','/','4','5','6','*','1','2','3','-','0','.','+','^'].map(i=>

<button key={i} onClick={()=>add(i)} className="border rounded-lg p-2">
{i}
</button>

)}

<button onClick={()=>add('(')}>(</button>
<button onClick={()=>add(')')}>)</button>
<button onClick={()=>add('Math.sqrt(')}>√</button>
<button onClick={calc} className="bg-green-500 text-white">=</button>

<button
onClick={clear}
className="col-span-4 bg-red-500 text-white rounded-lg p-2"
>
C
</button>

</div>

</div>

)

}