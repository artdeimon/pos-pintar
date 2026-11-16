<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PosController extends Controller
{
    private function user(Request $request): object { return $request->attributes->get('pos_user'); }
    private function storeId(Request $request): int { $u=$this->user($request); return (int)($u->role === 'cashier' ? $u->owner_id : $u->id); }
    private function ownerOnly(Request $request) { return $this->user($request)->role === 'owner' ? null : response()->json(['message'=>'Fitur ini hanya untuk owner.'],403); }
    private function issueToken(int $id): string
    {
        $token = Str::random(64);
        DB::table('users')->where('id', $id)->update(['api_token' => hash('sha256', $token), 'updated_at' => now()]);
        return $token;
    }

    public function login(Request $request)
    {
        $data=$request->validate(['username'=>'required|string|max:100','password'=>'required|string']);
        $user=DB::table('users')->where('username',$data['username'])->first();
        if (!$user || !Hash::check($data['password'],$user->password)) return response()->json(['message'=>'Username atau password salah.'],422);
        return response()->json(['token'=>$this->issueToken($user->id),'user'=>DB::table('users')->select('id','name','email','store_name')->find($user->id)]);
    }
    public function logout(Request $request) { DB::table('users')->where('id',$this->user($request)->id)->update(['api_token'=>null]); return response()->json(['message'=>'Berhasil keluar.']); }
    public function changePassword(Request $request)
    {
        $data=$request->validate(['current_password'=>'required|string','password'=>'required|string|min:8|confirmed']);
        $user=$this->user($request);
        if(!Hash::check($data['current_password'],$user->password))return response()->json(['message'=>'Password saat ini tidak sesuai.'],422);
        $token=Str::random(64);
        DB::table('users')->where('id',$user->id)->update(['password'=>Hash::make($data['password']),'api_token'=>hash('sha256',$token),'updated_at'=>now()]);
        return response()->json(['message'=>'Password berhasil diubah.','token'=>$token]);
    }
    public function me(Request $request) { $u=$this->user($request); $owner=DB::table('users')->find($this->storeId($request)); return response()->json(['id'=>$u->id,'name'=>$u->name,'username'=>$u->username,'role'=>$u->role,'email'=>$u->email,'store_name'=>$owner?->store_name]); }
    public function products(Request $request) { return response()->json(DB::table('products')->where('user_id',$this->storeId($request))->orderByDesc('id')->get()); }
    public function cashiers(Request $request)
    {
        if($denied=$this->ownerOnly($request))return $denied;
        return response()->json(DB::table('users')->where('owner_id',$this->user($request)->id)->where('role','cashier')->orderBy('name')->get(['id','name','username','created_at']));
    }
    public function createCashier(Request $request)
    {
        if($denied=$this->ownerOnly($request))return $denied;
        $d=$request->validate(['name'=>'required|string|max:120','username'=>'required|string|max:100|alpha_dash|unique:users,username','password'=>'required|string|min:8']);
        $id=DB::table('users')->insertGetId(['name'=>$d['name'],'username'=>$d['username'],'email'=>$d['username'].'@pos.local','password'=>Hash::make($d['password']),'role'=>'cashier','owner_id'=>$this->user($request)->id,'store_name'=>$this->user($request)->store_name,'created_at'=>now(),'updated_at'=>now()]);
        return response()->json(DB::table('users')->where('id',$id)->first(['id','name','username','role','created_at']),201);
    }
    public function createProduct(Request $request)
    {
        if($denied=$this->ownerOnly($request))return $denied;
        $d=$request->validate(['name'=>'required|string|max:160','category'=>'nullable|string|max:100','stock'=>'required|integer|min:0','low_stock_at'=>'nullable|integer|min:0','variants'=>'required|array|min:1','variants.*.name'=>'required|string|max:100','variants.*.price'=>'required|integer|min:1']);
        $id=DB::table('products')->insertGetId(['user_id'=>$this->storeId($request),'name'=>$d['name'],'category'=>$d['category']??'Umum','stock'=>$d['stock'],'low_stock_at'=>$d['low_stock_at']??10,'variants'=>json_encode($d['variants']),'created_at'=>now(),'updated_at'=>now()]);
        return response()->json(DB::table('products')->find($id),201);
    }
    public function updateProduct(Request $request,int $product)
    {
        if($denied=$this->ownerOnly($request))return $denied;
        $p=DB::table('products')->where('user_id',$this->storeId($request))->find($product); if(!$p)return response()->json(['message'=>'Produk tidak ditemukan.'],404);
        $d=$request->validate(['name'=>'sometimes|required|string|max:160','category'=>'sometimes|string|max:100','stock'=>'sometimes|required|integer|min:0','low_stock_at'=>'sometimes|integer|min:0','variants'=>'sometimes|required|array|min:1','variants.*.name'=>'required|string|max:100','variants.*.price'=>'required|integer|min:1']);
        if(isset($d['variants']))$d['variants']=json_encode($d['variants']); $d['updated_at']=now(); DB::table('products')->where('id',$product)->update($d);
        return response()->json(DB::table('products')->find($product));
    }
    public function deleteProduct(Request $request,int $product)
    {
        if($denied=$this->ownerOnly($request))return $denied;
        $deleted=DB::table('products')->where('user_id',$this->storeId($request))->whereNotIn('id',DB::table('transaction_items')->select('product_id'))->where('id',$product)->delete();
        return $deleted?response()->json(['message'=>'Produk dihapus.']):response()->json(['message'=>'Produk tidak ditemukan atau sudah memiliki transaksi.'],422);
    }
    public function checkout(Request $request)
    {
        $d=$request->validate(['payment_method'=>'required|in:cash,qris','items'=>'required|array|min:1','items.*.product_id'=>'required|integer','items.*.variant'=>'required|string|max:100','items.*.quantity'=>'required|integer|min:1']);
        $user=$this->user($request);$storeId=$this->storeId($request);
        $result=DB::transaction(function()use($d,$user,$storeId){
            $rows=[];$total=0;$requested=[];
            foreach($d['items'] as $item)$requested[$item['product_id']]=($requested[$item['product_id']]??0)+$item['quantity'];
            $available=[];
            foreach($requested as $productId=>$quantity){$p=DB::table('products')->where('user_id',$storeId)->where('id',$productId)->lockForUpdate()->first();if(!$p)throw ValidationException::withMessages(['items'=>'Produk tidak ditemukan.']);
                $reserved=(int)DB::table('transaction_items')->join('transactions','transactions.id','=','transaction_items.transaction_id')->where('transactions.status','pending')->where('transaction_items.product_id',$p->id)->sum('transaction_items.quantity');
                if($p->stock-$reserved<$quantity)throw ValidationException::withMessages(['items'=>"Stok {$p->name} tidak cukup."]);$available[$productId]=$p;
            }
            foreach($d['items'] as $item){$p=$available[$item['product_id']];
                $variants=json_decode($p->variants,true)??[];$v=collect($variants)->firstWhere('name',$item['variant']);if(!$v)throw ValidationException::withMessages(['items'=>'Varian produk tidak ditemukan.']);
                $sub=$v['price']*$item['quantity'];$total+=$sub;$rows[]=['product'=>$p,'variant'=>$v,'quantity'=>$item['quantity'],'subtotal'=>$sub];
            }
            $code='TRX-'.strtoupper(Str::random(10));$id=DB::table('transactions')->insertGetId(['user_id'=>$storeId,'cashier_id'=>$user->id,'code'=>$code,'total'=>$total,'payment_method'=>$d['payment_method'],'status'=>$d['payment_method']==='cash'?'paid':'pending','paid_at'=>$d['payment_method']==='cash'?now():null,'created_at'=>now(),'updated_at'=>now()]);
            foreach($rows as $r)DB::table('transaction_items')->insert(['transaction_id'=>$id,'product_id'=>$r['product']->id,'product_name'=>$r['product']->name,'variant_name'=>$r['variant']['name'],'quantity'=>$r['quantity'],'unit_price'=>$r['variant']['price'],'subtotal'=>$r['subtotal'],'created_at'=>now(),'updated_at'=>now()]);
            if($d['payment_method']==='cash')$this->deductStock($id);
            return ['id'=>$id,'code'=>$code,'total'=>$total];
        });
        if($d['payment_method']==='cash')return response()->json($this->transactionPayload($result['id']),201);
        $key=config('services.midtrans.server_key');
        if(!$key){DB::table('transactions')->where('id',$result['id'])->update(['status'=>'failed']);return response()->json(['message'=>'QRIS belum dikonfigurasi. Isi MIDTRANS_SERVER_KEY di .env.'],503);}
        try{$response=Http::withBasicAuth($key,'')->acceptJson()->post(config('services.midtrans.url').'/v2/charge',['payment_type'=>'qris','transaction_details'=>['order_id'=>$result['code'],'gross_amount'=>$result['total']],'qris'=>['acquirer'=>'gopay']]);
            if(!$response->successful())throw new \RuntimeException('Midtrans menolak transaksi: '.$response->body());
            $body=$response->json();$qr=collect($body['actions']??[])->firstWhere('name','generate-qr-code')['url']??null;
            DB::table('transactions')->where('id',$result['id'])->update(['provider_reference'=>$body['transaction_id']??$result['code'],'qr_code_url'=>$qr,'updated_at'=>now()]);
            return response()->json($this->transactionPayload($result['id']),201);
        }catch(\Throwable $e){DB::table('transactions')->where('id',$result['id'])->update(['status'=>'failed']);return response()->json(['message'=>'Gagal membuat QRIS. Periksa konfigurasi gateway.'],502);}
    }
    private function deductStock(int $transactionId): void
    {
        foreach(DB::table('transaction_items')->where('transaction_id',$transactionId)->get() as $line){DB::table('products')->where('id',$line->product_id)->decrement('stock',$line->quantity);}
    }
    private function transactionPayload(int $id): array
    {
        $t=DB::table('transactions')->find($id);$t->items=DB::table('transaction_items')->where('transaction_id',$id)->get();return (array)$t;
    }
    public function transactions(Request $request)
    {
        if($denied=$this->ownerOnly($request))return $denied;
        return response()->json(DB::table('transactions')->where('user_id',$this->storeId($request))->orderByDesc('id')->get()->map(function($t){$t->items=DB::table('transaction_items')->where('transaction_id',$t->id)->get();return $t;}));
    }
    public function dashboard(Request $request)
    {
        if($denied=$this->ownerOnly($request))return $denied;
        $uid=$this->storeId($request);
        return response()->json(['today_total'=>DB::table('transactions')->where('user_id',$uid)->where('status','paid')->whereDate('paid_at',today())->sum('total'),'today_count'=>DB::table('transactions')->where('user_id',$uid)->where('status','paid')->whereDate('paid_at',today())->count(),'products'=>DB::table('products')->where('user_id',$uid)->count(),'low_stock'=>DB::table('products')->where('user_id',$uid)->whereColumn('stock','<=','low_stock_at')->count()]);
    }
    public function notification(Request $request)
    {
        $key=config('services.midtrans.server_key');if(!$key)return response()->json(['message'=>'Gateway belum dikonfigurasi.'],503);
        $data=$request->validate(['order_id'=>'required|string','status_code'=>'required|string','gross_amount'=>'required|string','signature_key'=>'required|string','transaction_status'=>'required|string']);
        $expected=hash('sha512',$data['order_id'].$data['status_code'].$data['gross_amount'].$key);
        if(!hash_equals($expected,$data['signature_key']))return response()->json(['message'=>'Signature tidak valid.'],403);
        $t=DB::table('transactions')->where('code',$data['order_id'])->first();if(!$t)return response()->json(['message'=>'Transaksi tidak ditemukan.'],404);
        if($data['transaction_status']==='settlement'||$data['transaction_status']==='capture')DB::transaction(function()use($t){$locked=DB::table('transactions')->where('id',$t->id)->lockForUpdate()->first();if($locked->status!=='paid'){DB::table('transactions')->where('id',$t->id)->update(['status'=>'paid','paid_at'=>now(),'updated_at'=>now()]);$this->deductStock($t->id);}});
        elseif(in_array($data['transaction_status'],['expire','cancel','deny'],true))DB::table('transactions')->where('id',$t->id)->where('status','pending')->update(['status'=>'expired','updated_at'=>now()]);
        return response()->json(['message'=>'OK']);
    }
}
