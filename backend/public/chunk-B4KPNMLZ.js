import{a as N}from"./chunk-KR442EKC.js";import{h as T}from"./chunk-RCLABZBX.js";import{a as k}from"./chunk-OMNWSMN2.js";import{C as S,F as $,J as l,O as I,Zc as h,a as v,aa as O,ca as A,cd as f,ga as u,la as m,m as C,r as c,s as y}from"./chunk-G6OUGGHL.js";var b=class d{constructor(e){this.http=e;let t=f.apiUrl;try{let r=new URL(t);this.bridgeUrl=`${r.protocol}//${r.hostname}:9000`}catch{this.bridgeUrl="http://localhost:9000"}}bridgeUrl;printOrder(e){let t=this.convertToOrderDto(e);return this.http.post(`${this.bridgeUrl}/print`,t).pipe(l(r=>r.status===0||r.error instanceof ProgressEvent?(console.error("\u274C Print Bridge n\xE3o est\xE1 dispon\xEDvel"),console.error("\u{1F4A1} Certifique-se de que o servi\xE7o Print Bridge est\xE1 rodando em http://localhost:9000"),y(()=>new Error("Print Bridge n\xE3o est\xE1 dispon\xEDvel. Verifique se o servi\xE7o est\xE1 rodando."))):(console.error("\u274C Erro ao comunicar com Print Bridge:",r),y(()=>new Error(r.error?.detail||r.error?.message||"Erro ao enviar para impress\xE3o")))))}convertToOrderDto(e){let t=(e.items||[]).map(s=>({quantity:s.quantity||0,price:String(s.price||s.subtotal||0),product:s.product?{name:s.product.name||""}:null,combo:s.combo?{name:s.combo.name||""}:null,is_combo:s.is_combo||!1,sale_type:s.sale_type||null})),r=[],a=null,i=null;e.payment?Array.isArray(e.payment)?(r=e.payment.map(s=>({payment_method:s.payment_method||e.payment_method||"",amount:String(s.amount||e.total||0)})),e.payment.length>0&&(a=e.payment[0].received_amount!=null&&e.payment[0].received_amount!==""?String(e.payment[0].received_amount):null,i=e.payment[0].change_amount!=null&&e.payment[0].change_amount!==""?String(e.payment[0].change_amount):null)):(r=[{payment_method:e.payment.payment_method||e.payment_method||"",amount:String(e.payment.amount||e.total||0)}],a=e.payment.received_amount!=null&&e.payment.received_amount!==""?String(e.payment.received_amount):null,i=e.payment.change_amount!=null&&e.payment.change_amount!==""?String(e.payment.change_amount):null):e.payment_method&&(r=[{payment_method:e.payment_method,amount:String(e.total||0)}]);let n=null;return e.delivery_address&&(n={street:e.delivery_address.street||e.delivery_address.address||null,number:e.delivery_address.number||null,neighborhood:e.delivery_address.neighborhood||null,city:e.delivery_address.city||null,complement:e.delivery_address.complement||null,zipcode:e.delivery_address.zipcode||e.delivery_address.cep||null,state:e.delivery_address.state||e.delivery_address.uf||null}),{id:e.id||0,order_number:e.order_number||"",total:String(e.total||0),status:e.status||null,user:e.user?{name:e.user.name||"",phone:e.user.phone||null}:null,items:t,payment:r.length>0?r:null,payment_method:e.payment_method||null,delivery_address:n,delivery_notes:e.delivery_notes||null,delivery_fee:e.delivery_fee!=null?String(e.delivery_fee):"0",created_at:e.created_at||new Date().toISOString(),received_amount:a,change_amount:i}}checkHealth(){return this.http.get(`${this.bridgeUrl}/health`).pipe(l(e=>e.status===0||e.error instanceof ProgressEvent?y(()=>new Error("Print Bridge n\xE3o est\xE1 dispon\xEDvel")):y(()=>new Error("Erro ao verificar status do Print Bridge"))))}static \u0275fac=function(t){return new(t||d)(m(h))};static \u0275prov=u({token:d,factory:d.\u0275fac,providedIn:"root"})};var P=class d{constructor(e,t){this.http=e;this.printingBridge=t;this.loadConfig()}configKey="printer_config";defaultConfig={useDefaultPrinter:!0,autoPrint:!0};apiUrl=`${f.apiUrl}/orders`;loadConfig(){try{let e=localStorage.getItem(this.configKey);if(e){let t=JSON.parse(e);return v(v({},this.defaultConfig),t)}}catch(e){console.error("Erro ao carregar configura\xE7\xE3o de impressora:",e)}return this.defaultConfig}saveConfig(e){try{let t=this.loadConfig(),r=v(v({},t),e);localStorage.setItem(this.configKey,JSON.stringify(r))}catch(t){console.error("Erro ao salvar configura\xE7\xE3o de impressora:",t)}}getConfig(){return this.loadConfig()}printOrderManual(e){this.printingBridge.printOrder(e).subscribe({next:t=>{t.success?console.log(`%c\u2705 Pedido #${e.order_number} impresso com sucesso (2 vias)`,"color: green; font-weight: bold;"):(console.error(`%c\u274C ${t.message}`,"color: red; font-weight: bold;"),this.fallbackToBackendPrint(e))},error:t=>{console.error("%c\u274C Erro ao imprimir via Print Bridge:","color: red; font-weight: bold;",t),this.fallbackToBackendPrint(e)}})}printOrder(e,t=1){for(let r=0;r<t;r++)r>0?setTimeout(()=>this.printSingleOrder(e),r*500):this.printSingleOrder(e)}printSingleOrder(e){let t=window.open("","_blank","width=1,height=1");if(!t){console.error("N\xE3o foi poss\xEDvel abrir janela de impress\xE3o");return}let r=new Date(e.created_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}),a=o=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(o),i=o=>({pending:"Pendente",delivering:"Em Entrega",completed:"Conclu\xEDdo",cancelled:"Cancelado"})[o]||o;t.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pedido #${e.order_number}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              @page {
                size: 80mm 297mm;
                margin: 0;
              }
            }
            body {
              font-family: 'Courier New', monospace;
              width: 80mm;
              padding: 5mm;
              margin: 0;
              box-sizing: border-box;
            }
            .header {
              text-align: center;
              margin-bottom: 10mm;
            }
            .header h1 {
              font-size: 16pt;
              margin: 0;
            }
            .header p {
              font-size: 10pt;
              margin: 2mm 0;
            }
            .order-info {
              margin-bottom: 5mm;
              font-size: 10pt;
            }
            .customer-info {
              margin-bottom: 5mm;
              font-size: 10pt;
            }
            .items {
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
              padding: 3mm 0;
              margin: 3mm 0;
            }
            .item {
              font-size: 10pt;
              margin: 2mm 0;
            }
            .item .quantity {
              display: inline-block;
              width: 15mm;
            }
            .item .name {
              display: inline-block;
              width: 40mm;
            }
            .item .price {
              display: inline-block;
              width: 20mm;
              text-align: right;
            }
            .total {
              text-align: right;
              font-size: 12pt;
              font-weight: bold;
              margin: 5mm 0;
            }
            .footer {
              text-align: center;
              font-size: 10pt;
              margin-top: 10mm;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ADEGA GS</h1>
            <p>CNPJ: XX.XXX.XXX/0001-XX</p>
            <p>Rua Exemplo, 123 - Centro</p>
            <p>Tel: (11) 9999-9999</p>
          </div>

          <div class="order-info">
            <p><strong>Pedido:</strong> #${e.order_number}</p>
            <p><strong>Data:</strong> ${r}</p>
            <p><strong>Status:</strong> ${i(e.status)}</p>
          </div>

          <div class="customer-info">
            <p><strong>Cliente:</strong> ${e.user.name}</p>
            ${e.user.phone?`<p><strong>Telefone:</strong> ${e.user.phone}</p>`:""}
          </div>

          <div class="items">
            ${e.items.map(o=>`
              <div class="item">
                <span class="quantity">${o.quantity}x</span>
                <span class="name">${o.is_combo&&o.combo?o.combo.name:o.product?.name||"Produto n\xE3o encontrado"}</span>
                <span class="price">${a(o.price*o.quantity)}</span>
              </div>
            `).join("")}
          </div>

          <div class="total">
            Total: ${a(this.parseNumber(e.total))}
          </div>

          <div class="payment-info">
            <p><strong>Forma de Pagamento:</strong> ${this.getPaymentMethod(e)}</p>
          </div>

          <div class="footer">
            <p>Agradecemos a prefer\xEAncia!</p>
            <p>www.adegags.com.br</p>
          </div>
        </body>
      </html>
    `),t.document.close();let n=()=>{try{setTimeout(()=>{t.print(),setTimeout(()=>{try{t.close()}catch{}},2e3)},100)}catch(o){console.error("Erro ao imprimir:",o),t.close()}};t.document.readyState==="complete"?n():(t.onload=n,setTimeout(n,1e3))}autoPrintOrder(e){this.loadConfig().autoPrint&&this.printingBridge.printOrder(e).subscribe({next:r=>{r.success||(console.error(`%c\u274C ${r.message}`,"color: red; font-weight: bold;"),this.fallbackToBackendPrint(e))},error:r=>{console.error("%c\u274C Erro ao imprimir via Print Bridge:","color: red; font-weight: bold;",r),this.fallbackToBackendPrint(e)}})}generateOrderHtml(e){let t=new Date(e.created_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}),r=i=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(i),a=i=>({pending:"Pendente",delivering:"Em Entrega",completed:"Conclu\xEDdo",cancelled:"Cancelado"})[i]||i;return`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pedido #${e.order_number}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              @page {
                size: 80mm 297mm;
                margin: 0;
              }
            }
            body {
              font-family: 'Courier New', monospace;
              width: 80mm;
              padding: 5mm;
              margin: 0;
              box-sizing: border-box;
            }
            .header {
              text-align: center;
              margin-bottom: 10mm;
            }
            .header h1 {
              font-size: 16pt;
              margin: 0;
            }
            .header p {
              font-size: 10pt;
              margin: 2mm 0;
            }
            .order-info {
              margin-bottom: 5mm;
              font-size: 10pt;
            }
            .customer-info {
              margin-bottom: 5mm;
              font-size: 10pt;
            }
            .items {
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
              padding: 3mm 0;
              margin: 3mm 0;
            }
            .item {
              font-size: 10pt;
              margin: 2mm 0;
            }
            .item .quantity {
              display: inline-block;
              width: 15mm;
            }
            .item .name {
              display: inline-block;
              width: 40mm;
            }
            .item .price {
              display: inline-block;
              width: 20mm;
              text-align: right;
            }
            .total {
              text-align: right;
              font-size: 12pt;
              font-weight: bold;
              margin: 5mm 0;
            }
            .footer {
              text-align: center;
              font-size: 10pt;
              margin-top: 10mm;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ADEGA GS</h1>
            <p>CNPJ: XX.XXX.XXX/0001-XX</p>
            <p>Rua Exemplo, 123 - Centro</p>
            <p>Tel: (11) 9999-9999</p>
          </div>

          <div class="order-info">
            <p><strong>Pedido:</strong> #${e.order_number}</p>
            <p><strong>Data:</strong> ${t}</p>
            <p><strong>Status:</strong> ${a(e.status)}</p>
          </div>

          <div class="customer-info">
            <p><strong>Cliente:</strong> ${e.user.name}</p>
            ${e.user.phone?`<p><strong>Telefone:</strong> ${e.user.phone}</p>`:""}
          </div>

          <div class="items">
            ${e.items.map(i=>`
              <div class="item">
                <span class="quantity">${i.quantity}x</span>
                <span class="name">${i.is_combo&&i.combo?i.combo.name:i.product?.name||"Produto n\xE3o encontrado"}</span>
                <span class="price">${r(i.price*i.quantity)}</span>
              </div>
            `).join("")}
          </div>

          <div class="total">
            Total: ${r(this.parseNumber(e.total))}
          </div>

          <div class="payment-info">
            <p><strong>Forma de Pagamento:</strong> ${this.getPaymentMethod(e)}</p>
          </div>

          <div class="footer">
            <p>Agradecemos a prefer\xEAncia!</p>
            <p>www.adegags.com.br</p>
          </div>
        </body>
      </html>
    `}fallbackToBackendPrint(e){this.http.post(`${this.apiUrl}/${e.id}/print`,{}).subscribe({next:t=>{t.success||console.error(`%c\u274C ${t.message}`,"color: red; font-weight: bold;")},error:t=>{console.error("%c\u274C Erro ao imprimir via backend (fallback):","color: red; font-weight: bold;",t)}})}parseNumber(e){if(typeof e=="number")return isNaN(e)?0:e;if(typeof e=="string"){let t=parseFloat(e);return isNaN(t)?0:t}if(e==null)return 0;try{let t=String(e),r=parseFloat(t);return isNaN(r)?0:r}catch{return 0}}getPaymentMethod(e){if(e.payment_method)return this.formatPaymentMethod(e.payment_method);if(e.payment){if(Array.isArray(e.payment)&&e.payment.length>0)return this.formatPaymentMethod(e.payment[0].payment_method);if(!Array.isArray(e.payment))return this.formatPaymentMethod(e.payment.payment_method)}return"N\xE3o informado"}formatPaymentMethod(e){return{dinheiro:"Dinheiro",cartao:"Cart\xE3o",pix:"PIX",credito:"Cart\xE3o de Cr\xE9dito",debito:"Cart\xE3o de D\xE9bito"}[e]||e}static \u0275fac=function(t){return new(t||d)(m(h),m(b))};static \u0275prov=u({token:d,factory:d.\u0275fac,providedIn:"root"})};var D=class d{constructor(e,t,r,a,i){this.http=e;this.orderService=t;this.printService=r;this.authService=a;this.toastr=i;this.loadPrintedIdsFromStorage(),this.listenToAuthStatus()}apiUrl=`${f.apiUrl}/orders`;PRINTED_IDS_KEY="adega_impressao_ids";pollingSubscription;isPollingActive=!1;printedOrderIds=new Set;pendingOrdersSubject=new C([]);pendingOrders$=this.pendingOrdersSubject.asObservable();userSubscription;loadPrintedIdsFromStorage(){let e=localStorage.getItem(this.PRINTED_IDS_KEY);if(e)try{this.printedOrderIds=new Set(JSON.parse(e)),console.log(`[Polling] Mem\xF3ria de impress\xE3o carregada. ${this.printedOrderIds.size} IDs j\xE1 impressos.`)}catch(t){console.error("[Polling] Erro ao carregar mem\xF3ria de impress\xE3o:",t),this.printedOrderIds=new Set}}savePrintedIdsToStorage(){try{localStorage.setItem(this.PRINTED_IDS_KEY,JSON.stringify(Array.from(this.printedOrderIds)))}catch(e){console.error("[Polling] Erro ao salvar mem\xF3ria de impress\xE3o:",e)}}listenToAuthStatus(){this.checkAndStartPolling(),this.userSubscription=this.authService.authStatus$.subscribe(()=>{this.checkAndStartPolling()})}checkAndStartPolling(){let e=this.authService.isLoggedIn(),t=this.authService.getUserType();e&&(t==="employee"||t==="admin")?this.isPollingActive||this.startPolling():this.isPollingActive&&this.stopPolling()}startPolling(){if(this.isPollingActive)return;let e=this.authService.getUser();if(!e||e.type!=="employee"&&e.type!=="admin")return;this.isPollingActive=!0,console.log('[Polling] Iniciando... "Priming" da mem\xF3ria de impress\xE3o...');let t=this.orderService.fetchOrders({page:1,per_page:50,status:"pending"}).pipe(l(n=>(console.error("Erro ao buscar pedidos pending no priming:",n),c({data:[],total:0,current_page:1,per_page:50,last_page:1})))),r=this.orderService.fetchOrders({page:1,per_page:50,status:"processing"}).pipe(l(n=>(console.error("Erro ao buscar pedidos processing no priming:",n),c({data:[],total:0,current_page:1,per_page:50,last_page:1})))),a=this.orderService.fetchOrders({page:1,per_page:50,status:"preparing"}).pipe(l(n=>(console.error("Erro ao buscar pedidos preparing no priming:",n),c({data:[],total:0,current_page:1,per_page:50,last_page:1})))),i=this.orderService.fetchOrders({page:1,per_page:50,status:"delivering"}).pipe(l(n=>(console.error("Erro ao buscar pedidos delivering no priming:",n),c({data:[],total:0,current_page:1,per_page:50,last_page:1}))));S({pending:t,processing:r,preparing:a,delivering:i}).pipe(I(1)).subscribe({next:n=>{let o=[...n.pending.data,...n.processing.data,...n.preparing.data,...n.delivering.data],s=Array.from(new Map(o.map(p=>[p.id,p])).values());s.forEach(p=>{this.printedOrderIds.add(p.id)}),this.savePrintedIdsToStorage(),console.log(`[Polling] 'Priming' conclu\xEDdo. ${s.length} pedidos existentes foram adicionados \xE0 mem\xF3ria para ignorar.`),this.pollingSubscription=$(1e4).pipe(A(()=>this.isPollingActive),O(()=>this.checkForNewPendingOrders())).subscribe({next:p=>{p&&p.length>0&&(console.log(`[Polling] ${p.length} novos pedidos detectados para impress\xE3o.`),this.printNewOrders(p))},error:p=>{console.error("\u274C Erro no polling de pedidos:",p)}})},error:n=>{console.error('\u274C Erro ao "primar" o poller:',n),this.isPollingActive=!1}})}stopPolling(){this.isPollingActive&&(this.isPollingActive=!1,this.pollingSubscription&&(this.pollingSubscription.unsubscribe(),this.pollingSubscription=void 0))}clearPrintedCache(){this.printedOrderIds.clear()}checkForNewPendingOrders(){if(!this.isPollingActive)return c([]);let e=this.orderService.fetchOrders({page:1,per_page:20,status:"pending"}).pipe(l(i=>(console.error("Erro ao buscar pedidos pending:",i),c({data:[],total:0,current_page:1,per_page:20,last_page:1})))),t=this.orderService.fetchOrders({page:1,per_page:20,status:"processing"}).pipe(l(i=>(console.error("Erro ao buscar pedidos processing:",i),c({data:[],total:0,current_page:1,per_page:20,last_page:1})))),r=this.orderService.fetchOrders({page:1,per_page:20,status:"preparing"}).pipe(l(i=>(console.error("Erro ao buscar pedidos preparing:",i),c({data:[],total:0,current_page:1,per_page:20,last_page:1})))),a=this.orderService.fetchOrders({page:1,per_page:20,status:"delivering"}).pipe(l(i=>(console.error("Erro ao buscar pedidos delivering:",i),c({data:[],total:0,current_page:1,per_page:20,last_page:1}))));return S({pending:e,processing:t,preparing:r,delivering:a}).pipe(O(({pending:i,processing:n,preparing:o,delivering:s})=>{let p=[...i.data,...n.data,...o.data,...s.data],E=Array.from(new Map(p.map(g=>[g.id,g])).values());this.pendingOrdersSubject.next(E);let B=E.filter(g=>{let q=!this.printedOrderIds.has(g.id),_=g.payment||[],w=Array.isArray(_)?_[0]?.payment_method:_?.payment_method,j=g.status==="processing",X=g.status==="pending"&&(w==="dinheiro"||w==="cart\xE3o de d\xE9bito");return q&&(j||X)});return c(B)}))}printNewOrders(e){!e||e.length===0||this.authService.getUserType()!=="employee"||e.forEach((r,a)=>{let i=r.payment||[],n=Array.isArray(i)?i[0]?.payment_method:i?.payment_method,o="Novo Pedido!";r.status==="processing"?o="Novo Pedido (PIX Pago)!":n==="dinheiro"?o="Novo Pedido (Dinheiro)!":n==="cart\xE3o de d\xE9bito"&&(o="Novo Pedido (Cart\xE3o na Entrega)!"),this.printedOrderIds.add(r.id),this.savePrintedIdsToStorage(),setTimeout(()=>{this.toastr.success(`Cliente: ${r.user.name}`,`${o} #${r.order_number}`,{timeOut:3e4,closeButton:!0,tapToDismiss:!0}),this.printService.autoPrintOrder(r)},a*1e3)})}isEmployee(e){return e&&e.type==="employee"}isActive(){return this.isPollingActive}ngOnDestroy(){this.stopPolling(),this.userSubscription&&this.userSubscription.unsubscribe()}static \u0275fac=function(t){return new(t||d)(m(h),m(N),m(P),m(k),m(T))};static \u0275prov=u({token:d,factory:d.\u0275fac,providedIn:"root"})};export{P as a,D as b};
