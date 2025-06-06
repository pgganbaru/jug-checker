window.onload = async function () {                         //htmlが全部読み込まれてから
    const select = document.getElementById("daiSelect");
    const display = document.getElementById("kikaiwariDisp");

    let data = [];                                          

    try {
        const response = await fetch("./kikaiwari.json");   //機械割が記述されているjsonにフェッチ
        data = await response.json();

        data.forEach(machine => {
            const option = document.createElement("option");   //ダウンプルメニューに台の名前を送る
            option.value = machine.name;
            option.textContent = machine.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("JSONの読み込みに失敗しました。");        //json読み込み失敗をコンソール表示
    }

    document.getElementById("judgeBtn").addEventListener("click", function () {     //ボタンが押されたら
        const total = Number(document.getElementById("total").value);
        const big = Number(document.getElementById("big").value);       //それぞれの回転数・big・reg・ブドウをhtmlから取得
        const reg = Number(document.getElementById("reg").value);
        const budou = Number(document.getElementById("budou").value);

        if (!total || total <= 0) {                                    //総回転数が0回だったら無効
            display.innerHTML = "総回転数は1以上で入力してください。";
            return;
        }

        //安全な逆数と割り算（ゼロ除算防止）    NaNになってしまった
        const safeInv = v => v === 0 ? 0 : 1 / v;
        const safeDiv = (num, denom) => denom === 0 ? 0 : num / denom;

        //safeDivを使って安全にbig,reg,合算,ブドウ確率を求める
        const big1 = safeDiv(big, total);
        const reg1 = safeDiv(reg, total);
        const gassan = safeDiv(big + reg, total);
        const budou1 = safeDiv(budou, total);
        //表示用の確率を逆数で計算して入れる
        const bigText = `1/${safeInv(big1).toFixed(1)}`;
        const regText = `1/${safeInv(reg1).toFixed(1)}`;
        const gassanText = `1/${safeInv(gassan).toFixed(1)}`;
        const budouText = `1/${safeInv(budou1).toFixed(1)}`;
        //セレクトボックスで選ばれた台を取得
        const selectName = select.value;
        const machine = data.find(item => item.name === selectName);
        if (!machine) {
            display.innerHTML = "台が選択されていません。";             //見つからなかったらこれを出力
            return;
        }

        //正規化係数（正規化用の重み)
        const bigWeight = 0.00026 || 1;                     //NaN防止の念のためのfallback
        const regWeight = 0.00165 || 1;
        const gassanWeight = 0.00191 || 1;
        const budouWeight = 0.0069 || 1;

        //回転数の重みを付ける(試行回数が少ないと信頼度は落ちる)
        const reliability = Math.min(total / 10000, 1.0);   //総回転数から10000を割る。最大値は1。
        const alpha = reliability * 0.25;                    //１万回転回したとはいえ信頼できないので掛けて調整

        //実際値と設定1~6の理論値を比較
        const hyoukaList = [];
        for (let i = 1; i <= 6; i++) {
            const setting = machine[String(i)];
            if (!setting) continue;

            const setting_big = Number(setting.big) || 0;   //NaN防止
            const setting_reg = Number(setting.reg) || 0;
            const setting_gassan = Number(setting.gassan) || 0;
            const setting_budou = Number(setting.budou) || 0;

            const bigsa = safeDiv(Math.abs(big1 - setting_big), bigWeight); //実際値と理論値を絶対値で差を求め、逆数にする
            const regsa = safeDiv(Math.abs(reg1 - setting_reg), regWeight);
            const gassansa = safeDiv(Math.abs(gassan - setting_gassan), gassanWeight);
            const budousa = safeDiv(Math.abs(budou1 - setting_budou), budouWeight); //big差とブドウ差は使っていないが念のため。

            const score = regsa * 10 + gassansa * 6 * bigsa * 0.05;    //regと合算の重み付け　bigとブドウは設定差が小さいので無視
            hyoukaList.push({ setting: i, score });     //比較した値をlistに入れる
        }

        //指数関数をかけて評価が小さければ確率が高くなるよう変換
        const scores = hyoukaList.map(obj => Math.exp(-obj.score * alpha));
        const totalScore = scores.reduce((sum, s) => sum + s, 0);

        //指数関数で重みづけされた各設定の割合を出す
        const percentages = totalScore === 0
            ? Array(6).fill("0.00")
            : scores.map(s => (s / totalScore * 100).toFixed(2));

        //それぞれの設定推測を出力
        let resultText = "設定ごとの可能性:<br>";
        percentages.forEach((per, i) => {
            resultText += `設定${i + 1}: ${per}%<br>`;
        });

        resultText += "<br>";
        resultText += `BIG確率：${bigText}<br>`;
        resultText += `REG確率：${regText}<br>`;
        resultText += `合算確率：${gassanText}<br>`;
        resultText += `ぶどう確率：${budouText}`;

        display.innerHTML = resultText;
    });
};
