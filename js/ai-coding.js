/* Copilot coding skills — worked out live (no internet, no canned answer):
   1. Run JavaScript        "run this: console.log([1,2,3].map(x => x * 2))"  or a ```js block + "run"
   2. Write code            "write a function to reverse a string in python"
   3. Format / check JSON   "format this json {...}"  or just paste JSON
   4. Convert               "255 to binary", "0xff to decimal", "base64 encode hi", "camelCase my variable", "#ff8800 to rgb"
   5. Explain errors        paste an error like "TypeError: Cannot read properties of undefined (reading 'x')" */
(function () {
  "use strict";
  if (!window.Brain || !Brain.addSkill) return;
  const fence = (lang, code) => "```" + lang + "\n" + code.replace(/\s+$/, "") + "\n```";

  // ---------------- 1. Run JavaScript (in a Web Worker: own thread, no page access, stopped after 2 s) ----------------
  const WORKER_SRC = `
    const fmt=v=>{try{if(typeof v==="string")return v;if(typeof v==="function")return v.toString();if(v===undefined)return "undefined";return JSON.stringify(v,(k,x)=>typeof x==="bigint"?x+"n":x,2)??String(v)}catch(e){return String(v)}};
    let logs=[];
    ["log","info","warn","error","debug"].forEach(k=>console[k]=(...a)=>{if(logs.length<60)logs.push((k==="error"?"❌ ":k==="warn"?"⚠️ ":"")+a.map(fmt).join(" "))});
    self.onmessage=async(e)=>{let result,error;try{result=await (0,eval)(e.data);}catch(err){error=err&&err.name?err.name+": "+err.message:String(err)}
      postMessage({logs,result:result===undefined?undefined:fmt(result),error});};`;
  let workerUrl = null;
  function runJS(code) {
    return new Promise((resolve) => {
      if (!window.Worker) { resolve({ error: "This browser can't run code safely here." , logs: [] }); return; }
      workerUrl = workerUrl || URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
      const w = new Worker(workerUrl);
      const done = (out) => { clearTimeout(t); w.terminate(); resolve(out); };
      const t = setTimeout(() => done({ timeout: true, logs: [] }), 2000);
      w.onmessage = (e) => done(e.data);
      w.onerror = (e) => { e.preventDefault(); done({ error: e.message || "Error", logs: [] }); };
      w.postMessage(code);
    });
  }
  Brain.addSkill(async (text) => {
    let code = null;
    const fm = text.match(/```(?:js|javascript)?\s*\n?([\s\S]*?)```/i);
    if (fm && /\b(run|execute|output|result|what does this (print|log|return)|try)\b/i.test(text.replace(fm[0], ""))) code = fm[1];
    if (!code) { const m = text.match(/^\s*(?:run|execute|eval(?:uate)?)(?:\s+this)?(?:\s+(?:js|javascript|code))?\s*:?\s+([\s\S]+)$/i); if (m && /[();=+\-*/[\]{}.'"`]/.test(m[1])) code = m[1]; }
    if (!code) return null;
    const r = await runJS(code.trim());
    let out = "Here's what happened when I ran it:\n\n";
    if (r.timeout) return out + "⏱️ It ran for more than 2 seconds, so I stopped it. Check for an infinite loop.";
    if (r.logs && r.logs.length) out += "**Console**\n" + fence("text", r.logs.join("\n")) + "\n";
    if (r.error) out += "**Error** — " + r.error + "\n\nPaste the error on its own and I'll explain it.";
    else if (r.result !== undefined && !(r.logs && r.logs.length)) out += "**Result**\n" + fence("text", String(r.result));
    else if (!(r.logs && r.logs.length)) out += "It ran without errors and didn't print anything. Add `console.log(...)` to see values.";
    return out.trim();
  });

  // ---------------- 2. Write code for common tasks in 5 languages ----------------
  const LANGS = { python: "python", py: "python", javascript: "javascript", js: "javascript", java: "java", "c++": "cpp", cpp: "cpp", "c#": "csharp", csharp: "csharp" };
  const T = {
    hello: { re: /hello,? world/, name: "Hello world",
      python: `print("Hello, world!")`,
      javascript: `console.log("Hello, world!");`,
      java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, world!");\n    }\n}`,
      cpp: `#include <iostream>\n\nint main() {\n    std::cout << "Hello, world!" << std::endl;\n    return 0;\n}`,
      csharp: `using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, world!");\n    }\n}` },
    reverse: { re: /reverse (a |the )?(string|word|text)/, name: "Reverse a string",
      python: `def reverse(s):\n    return s[::-1]\n\nprint(reverse("hello"))  # olleh`,
      javascript: `function reverse(s) {\n  return [...s].reverse().join("");\n}\n\nconsole.log(reverse("hello")); // olleh`,
      java: `static String reverse(String s) {\n    return new StringBuilder(s).reverse().toString();\n}\n// reverse("hello") -> "olleh"`,
      cpp: `#include <algorithm>\n#include <string>\n\nstd::string reverseStr(std::string s) {\n    std::reverse(s.begin(), s.end());\n    return s;\n}`,
      csharp: `static string Reverse(string s) {\n    char[] a = s.ToCharArray();\n    Array.Reverse(a);\n    return new string(a);\n}` },
    palindrome: { re: /palindrome/, name: "Check for a palindrome",
      python: `def is_palindrome(s):\n    s = "".join(c.lower() for c in s if c.isalnum())\n    return s == s[::-1]\n\nprint(is_palindrome("Race car"))  # True`,
      javascript: `function isPalindrome(s) {\n  const t = s.toLowerCase().replace(/[^a-z0-9]/g, "");\n  return t === [...t].reverse().join("");\n}\n\nconsole.log(isPalindrome("Race car")); // true`,
      java: `static boolean isPalindrome(String s) {\n    String t = s.toLowerCase().replaceAll("[^a-z0-9]", "");\n    return new StringBuilder(t).reverse().toString().equals(t);\n}`,
      cpp: `#include <cctype>\n#include <string>\n\nbool isPalindrome(const std::string& s) {\n    std::string t;\n    for (char c : s) if (std::isalnum((unsigned char)c)) t += std::tolower((unsigned char)c);\n    return std::equal(t.begin(), t.begin() + t.size() / 2, t.rbegin());\n}`,
      csharp: `static bool IsPalindrome(string s) {\n    var t = new string(s.ToLower().Where(char.IsLetterOrDigit).ToArray());\n    return t.SequenceEqual(t.Reverse());\n}  // needs: using System.Linq;` },
    factorial: { re: /factorial/, name: "Factorial",
      python: `def factorial(n):\n    result = 1\n    for i in range(2, n + 1):\n        result *= i\n    return result\n\nprint(factorial(5))  # 120`,
      javascript: `function factorial(n) {\n  let result = 1;\n  for (let i = 2; i <= n; i++) result *= i;\n  return result;\n}\n\nconsole.log(factorial(5)); // 120`,
      java: `static long factorial(int n) {\n    long result = 1;\n    for (int i = 2; i <= n; i++) result *= i;\n    return result;\n}`,
      cpp: `long long factorial(int n) {\n    long long result = 1;\n    for (int i = 2; i <= n; i++) result *= i;\n    return result;\n}`,
      csharp: `static long Factorial(int n) {\n    long result = 1;\n    for (int i = 2; i <= n; i++) result *= i;\n    return result;\n}` },
    fibonacci: { re: /fibonacci|fib sequence/, name: "Fibonacci numbers",
      python: `def fibonacci(n):\n    a, b = 0, 1\n    seq = []\n    for _ in range(n):\n        seq.append(a)\n        a, b = b, a + b\n    return seq\n\nprint(fibonacci(10))  # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]`,
      javascript: `function fibonacci(n) {\n  const seq = [];\n  let a = 0, b = 1;\n  for (let i = 0; i < n; i++) { seq.push(a); [a, b] = [b, a + b]; }\n  return seq;\n}\n\nconsole.log(fibonacci(10));`,
      java: `static void fibonacci(int n) {\n    long a = 0, b = 1;\n    for (int i = 0; i < n; i++) {\n        System.out.print(a + " ");\n        long t = a + b; a = b; b = t;\n    }\n}`,
      cpp: `#include <iostream>\n\nvoid fibonacci(int n) {\n    long long a = 0, b = 1;\n    for (int i = 0; i < n; i++) {\n        std::cout << a << " ";\n        long long t = a + b; a = b; b = t;\n    }\n}`,
      csharp: `static void Fibonacci(int n) {\n    long a = 0, b = 1;\n    for (int i = 0; i < n; i++) {\n        Console.Write(a + " ");\n        (a, b) = (b, a + b);\n    }\n}` },
    fizzbuzz: { re: /fizz ?buzz/, name: "FizzBuzz",
      python: `for i in range(1, 101):\n    if i % 15 == 0:\n        print("FizzBuzz")\n    elif i % 3 == 0:\n        print("Fizz")\n    elif i % 5 == 0:\n        print("Buzz")\n    else:\n        print(i)`,
      javascript: `for (let i = 1; i <= 100; i++) {\n  console.log(i % 15 === 0 ? "FizzBuzz" : i % 3 === 0 ? "Fizz" : i % 5 === 0 ? "Buzz" : i);\n}`,
      java: `for (int i = 1; i <= 100; i++) {\n    if (i % 15 == 0) System.out.println("FizzBuzz");\n    else if (i % 3 == 0) System.out.println("Fizz");\n    else if (i % 5 == 0) System.out.println("Buzz");\n    else System.out.println(i);\n}`,
      cpp: `for (int i = 1; i <= 100; i++) {\n    if (i % 15 == 0) std::cout << "FizzBuzz\\n";\n    else if (i % 3 == 0) std::cout << "Fizz\\n";\n    else if (i % 5 == 0) std::cout << "Buzz\\n";\n    else std::cout << i << "\\n";\n}`,
      csharp: `for (int i = 1; i <= 100; i++) {\n    Console.WriteLine(i % 15 == 0 ? "FizzBuzz" : i % 3 == 0 ? "Fizz" : i % 5 == 0 ? "Buzz" : i.ToString());\n}` },
    prime: { re: /\bprimes?\b/, name: "Check if a number is prime",
      python: `def is_prime(n):\n    if n < 2:\n        return False\n    i = 2\n    while i * i <= n:\n        if n % i == 0:\n            return False\n        i += 1\n    return True\n\nprint(is_prime(29))  # True`,
      javascript: `function isPrime(n) {\n  if (n < 2) return false;\n  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;\n  return true;\n}\n\nconsole.log(isPrime(29)); // true`,
      java: `static boolean isPrime(int n) {\n    if (n < 2) return false;\n    for (int i = 2; (long) i * i <= n; i++) if (n % i == 0) return false;\n    return true;\n}`,
      cpp: `bool isPrime(int n) {\n    if (n < 2) return false;\n    for (long long i = 2; i * i <= n; i++) if (n % i == 0) return false;\n    return true;\n}`,
      csharp: `static bool IsPrime(int n) {\n    if (n < 2) return false;\n    for (long i = 2; i * i <= n; i++) if (n % i == 0) return false;\n    return true;\n}` },
    sum: { re: /sum (of )?(a |the )?(list|array|numbers)|add up (a |the )?(list|array)/, name: "Sum a list",
      python: `numbers = [3, 7, 2, 9]\nprint(sum(numbers))  # 21`,
      javascript: `const numbers = [3, 7, 2, 9];\nconst total = numbers.reduce((a, b) => a + b, 0);\nconsole.log(total); // 21`,
      java: `int[] numbers = {3, 7, 2, 9};\nint total = 0;\nfor (int n : numbers) total += n;\nSystem.out.println(total); // 21`,
      cpp: `#include <numeric>\n#include <vector>\n\nstd::vector<int> numbers = {3, 7, 2, 9};\nint total = std::accumulate(numbers.begin(), numbers.end(), 0); // 21`,
      csharp: `int[] numbers = { 3, 7, 2, 9 };\nConsole.WriteLine(numbers.Sum()); // 21  (using System.Linq;)` },
    max: { re: /(largest|biggest|max(imum)?) (number |value )?(in|of) (a |the )?(list|array)|find the max/, name: "Find the largest number",
      python: `numbers = [3, 7, 2, 9]\nprint(max(numbers))  # 9`,
      javascript: `const numbers = [3, 7, 2, 9];\nconsole.log(Math.max(...numbers)); // 9`,
      java: `int[] numbers = {3, 7, 2, 9};\nint max = numbers[0];\nfor (int n : numbers) if (n > max) max = n;\nSystem.out.println(max); // 9`,
      cpp: `#include <algorithm>\n#include <vector>\n\nstd::vector<int> numbers = {3, 7, 2, 9};\nint biggest = *std::max_element(numbers.begin(), numbers.end()); // 9`,
      csharp: `int[] numbers = { 3, 7, 2, 9 };\nConsole.WriteLine(numbers.Max()); // 9  (using System.Linq;)` },
    vowels: { re: /count (the )?vowels/, name: "Count vowels",
      python: `def count_vowels(s):\n    return sum(1 for c in s.lower() if c in "aeiou")\n\nprint(count_vowels("Hello World"))  # 3`,
      javascript: `const countVowels = (s) => (s.match(/[aeiou]/gi) || []).length;\nconsole.log(countVowels("Hello World")); // 3`,
      java: `static int countVowels(String s) {\n    int count = 0;\n    for (char c : s.toLowerCase().toCharArray()) if ("aeiou".indexOf(c) >= 0) count++;\n    return count;\n}`,
      cpp: `int countVowels(const std::string& s) {\n    int count = 0;\n    for (char c : s) if (std::string("aeiouAEIOU").find(c) != std::string::npos) count++;\n    return count;\n}`,
      csharp: `static int CountVowels(string s) => s.ToLower().Count(c => "aeiou".Contains(c));  // using System.Linq;` },
    temp: { re: /(celsius|fahrenheit).*(to|convert)|convert.*(celsius|fahrenheit)|temperature convert/, name: "Celsius ↔ Fahrenheit",
      python: `def c_to_f(c):\n    return c * 9 / 5 + 32\n\ndef f_to_c(f):\n    return (f - 32) * 5 / 9\n\nprint(c_to_f(100))  # 212.0`,
      javascript: `const cToF = (c) => c * 9 / 5 + 32;\nconst fToC = (f) => (f - 32) * 5 / 9;\nconsole.log(cToF(100)); // 212`,
      java: `static double cToF(double c) { return c * 9 / 5 + 32; }\nstatic double fToC(double f) { return (f - 32) * 5 / 9; }`,
      cpp: `double cToF(double c) { return c * 9 / 5 + 32; }\ndouble fToC(double f) { return (f - 32) * 5 / 9; }`,
      csharp: `static double CToF(double c) => c * 9 / 5 + 32;\nstatic double FToC(double f) => (f - 32) * 5 / 9;` },
    evenodd: { re: /even or odd|odd or even|is (a )?number even/, name: "Even or odd",
      python: `n = 7\nprint("even" if n % 2 == 0 else "odd")  # odd`,
      javascript: `const n = 7;\nconsole.log(n % 2 === 0 ? "even" : "odd"); // odd`,
      java: `int n = 7;\nSystem.out.println(n % 2 == 0 ? "even" : "odd");`,
      cpp: `int n = 7;\nstd::cout << (n % 2 == 0 ? "even" : "odd") << std::endl;`,
      csharp: `int n = 7;\nConsole.WriteLine(n % 2 == 0 ? "even" : "odd");` },
    sort: { re: /sort (a |the )?(list|array|numbers)/, name: "Sort a list",
      python: `numbers = [5, 2, 9, 1]\nnumbers.sort()            # in place\nprint(numbers)            # [1, 2, 5, 9]\nprint(sorted(numbers, reverse=True))  # [9, 5, 2, 1]`,
      javascript: `const numbers = [5, 2, 9, 1];\nnumbers.sort((a, b) => a - b); // numbers need a compare function!\nconsole.log(numbers); // [1, 2, 5, 9]`,
      java: `import java.util.Arrays;\n\nint[] numbers = {5, 2, 9, 1};\nArrays.sort(numbers);\nSystem.out.println(Arrays.toString(numbers));`,
      cpp: `#include <algorithm>\n#include <vector>\n\nstd::vector<int> numbers = {5, 2, 9, 1};\nstd::sort(numbers.begin(), numbers.end());`,
      csharp: `int[] numbers = { 5, 2, 9, 1 };\nArray.Sort(numbers);\nConsole.WriteLine(string.Join(", ", numbers));` },
    dedupe: { re: /remove duplicates|unique (values|items)/, name: "Remove duplicates",
      python: `items = [1, 2, 2, 3, 1]\nunique = list(dict.fromkeys(items))  # keeps the order\nprint(unique)  # [1, 2, 3]`,
      javascript: `const items = [1, 2, 2, 3, 1];\nconst unique = [...new Set(items)];\nconsole.log(unique); // [1, 2, 3]`,
      java: `import java.util.*;\n\nList<Integer> items = List.of(1, 2, 2, 3, 1);\nList<Integer> unique = new ArrayList<>(new LinkedHashSet<>(items));`,
      cpp: `#include <algorithm>\n#include <vector>\n\nstd::vector<int> v = {1, 2, 2, 3, 1};\nstd::sort(v.begin(), v.end());\nv.erase(std::unique(v.begin(), v.end()), v.end());`,
      csharp: `int[] items = { 1, 2, 2, 3, 1 };\nvar unique = items.Distinct().ToArray();  // using System.Linq;` },
  };
  Brain.addSkill((text) => {
    const t = text.toLowerCase();
    const LANG_RE = "(python|py|javascript|js|java(?!script)|c\\+\\+|cpp|c#|csharp)(?=\\W|$)";
    const lm = t.match(new RegExp("\\b(?:in|using|with)\\s+" + LANG_RE)) || t.match(new RegExp("(?:^|\\W)" + LANG_RE));
    if (!/\b(write|code|make|create|show|give|how (do|to|can) (i|you)|function|program|script|example)\b/.test(t) && !lm) return null;
    const task = Object.keys(T).find((k) => T[k].re.test(t));
    if (!task) return null;
    const lang = lm ? LANGS[lm[1]] : null;
    const label = { python: "Python", javascript: "JavaScript", java: "Java", cpp: "C++", csharp: "C#" };
    if (lang) return `**${T[task].name}** in ${label[lang]}:\n\n` + fence(lang === "cpp" ? "cpp" : lang, T[task][lang]) + (lang === "javascript" ? "\n\nWant to try it? Say **run this** and paste the code." : "");
    return `**${T[task].name}** — here it is in Python and JavaScript (ask for Java, C++ or C# too):\n\n` + fence("python", T[task].python) + "\n\n" + fence("javascript", T[task].javascript);
  });

  // ---------------- 3. Format / check JSON ----------------
  Brain.addSkill((text) => {
    let src = null;
    const m = text.match(/^\s*(?:format|pretty ?print|beautify|validate|check|fix|minify|is this valid)\s*(?:this|my)?\s*json\s*:?\s*([\s\S]+)$/i);
    if (m) src = m[1];
    else if (/^\s*[{[][\s\S]*[}\]]\s*$/.test(text) && /"/.test(text)) src = text;
    if (!src) return null;
    src = src.trim().replace(/^```(?:json)?\s*|```$/g, "").trim();
    const minify = /minify/i.test(text);
    try {
      const v = JSON.parse(src);
      const kind = Array.isArray(v) ? "an array with " + v.length + " item" + (v.length === 1 ? "" : "s") : v && typeof v === "object" ? "an object with " + Object.keys(v).length + " key" + (Object.keys(v).length === 1 ? "" : "s") : "a " + typeof v;
      return `✅ **Valid JSON** — ${kind}.\n\n` + fence("json", minify ? JSON.stringify(v) : JSON.stringify(v, null, 2));
    } catch (e) {
      const pos = +((e.message.match(/position (\d+)/) || [])[1]);
      let where = "";
      if (!isNaN(pos)) { const before = src.slice(0, pos); const line = before.split("\n").length, col = pos - before.lastIndexOf("\n"); where = ` at line ${line}, column ${col} (near \`${src.slice(Math.max(0, pos - 12), pos + 12).replace(/\n/g, " ")}\`)`; }
      const tips = [];
      if (/'/.test(src)) tips.push("JSON needs **double quotes** `\"` — single quotes `'` aren't allowed.");
      if (/,\s*[}\]]/.test(src)) tips.push("Remove the **trailing comma** before a closing `}` or `]`.");
      if (/[{,]\s*[A-Za-z_$][\w$]*\s*:/.test(src)) tips.push("Keys must be in quotes, like `\"name\": \"Sam\"`.");
      if (/\/\/|\/\*/.test(src)) tips.push("JSON doesn't allow **comments**.");
      return `❌ **Not valid JSON**${where}.\n\n${e.message}` + (tips.length ? "\n\n**Likely fix:**\n- " + tips.join("\n- ") : "");
    }
  });

  // ---------------- 4. Converters ----------------
  const b64e = (s) => btoa(unescape(encodeURIComponent(s)));
  const b64d = (s) => decodeURIComponent(escape(atob(s.trim())));
  const words = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_\-]+/g, " ").trim().split(/\s+/).filter(Boolean).map((w) => w.toLowerCase());
  const CASES = {
    camel: (w) => w.map((x, i) => (i ? x[0].toUpperCase() + x.slice(1) : x)).join(""),
    pascal: (w) => w.map((x) => x[0].toUpperCase() + x.slice(1)).join(""),
    snake: (w) => w.join("_"), kebab: (w) => w.join("-"), constant: (w) => w.join("_").toUpperCase(), title: (w) => w.map((x) => x[0].toUpperCase() + x.slice(1)).join(" "),
  };
  Brain.addSkill((text) => {
    const t = text.trim();
    let m;
    // number bases
    if ((m = t.match(/^(?:convert\s+)?(0x[0-9a-f]+|0b[01]+|0o[0-7]+|-?\d+)\s*(?:in|to|into)\s*(binary|bin|hex(?:adecimal)?|octal|oct|decimal|dec|base\s*(\d+))\s*\??$/i)) ||
        (m = t.match(/^(?:what is\s+)?(binary|hex(?:adecimal)?|octal)\s+([0-9a-f]+)\s*(?:in|to)\s*(decimal|dec)\s*\??$/i))) {
      let n, to;
      if (/^(binary|hex|octal)/i.test(m[1])) { const base = /^bin/i.test(m[1]) ? 2 : /^hex/i.test(m[1]) ? 16 : 8; n = parseInt(m[2], base); to = 10; }
      else { const s = m[1].toLowerCase(); n = s.startsWith("0x") ? parseInt(s.slice(2), 16) : s.startsWith("0b") ? parseInt(s.slice(2), 2) : s.startsWith("0o") ? parseInt(s.slice(2), 8) : parseInt(s, 10);
        const k = m[2].toLowerCase(); to = m[3] ? +m[3] : /^bin/.test(k) ? 2 : /^hex/.test(k) ? 16 : /^oct/.test(k) ? 8 : 10; }
      if (isNaN(n) || to < 2 || to > 36) return null;
      const r = n.toString(to).toUpperCase();
      const name = { 2: "binary", 8: "octal", 10: "decimal", 16: "hexadecimal" }[to] || "base " + to;
      return `**${r}** in ${name}.` + (to !== 10 ? `\n\n(${n} in decimal = ${n.toString(2)} binary = 0x${n.toString(16).toUpperCase()} hex = 0o${n.toString(8)} octal)` : "");
    }
    // base64 / url
    if ((m = t.match(/^base ?64 (encode|decode)\s*:?\s*([\s\S]+)$/i)) || (m = t.match(/^(encode|decode) ([\s\S]+?) (?:in|to|from) base ?64$/i))) {
      try { return m[1].toLowerCase() === "encode" ? "Base64: " + fence("text", b64e(m[2])) : "Decoded text: " + fence("text", b64d(m[2])); } catch (_) { return "That isn't valid Base64 text."; }
    }
    if ((m = t.match(/^url (encode|decode)\s*:?\s*([\s\S]+)$/i))) { try { return fence("text", m[1].toLowerCase() === "encode" ? encodeURIComponent(m[2]) : decodeURIComponent(m[2])); } catch (_) { return "That isn't valid URL-encoded text."; } }
    // text cases
    if ((m = t.match(/^(?:convert\s+)?([\s\S]+?)\s+(?:to|in|into)\s+(camel|pascal|snake|kebab|constant|title)\s*case$/i)) || (m = t.match(/^(camel|pascal|snake|kebab|constant|title)\s*case\s*:?\s+([\s\S]+)$/i))) {
      const [src, kind] = /^(camel|pascal|snake|kebab|constant|title)$/i.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]];
      const w = words(src.replace(/^["'`]|["'`]$/g, "")); if (!w.length) return null;
      return `**${kind[0].toUpperCase() + kind.slice(1).toLowerCase()} case:** \`${CASES[kind.toLowerCase()](w)}\``;
    }
    // colors
    if ((m = t.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b[\s\S]*\b(to )?rgb/i)) || (m = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i))) {
      let h = m[1]; if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return `#${h.toUpperCase()} = **rgb(${r}, ${g}, ${b})**`;
    }
    if ((m = t.match(/rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)[\s\S]*\b(to )?hex/i))) {
      const hx = [m[1], m[2], m[3]].map((v) => Math.min(255, +v).toString(16).padStart(2, "0")).join("").toUpperCase();
      return `rgb(${m[1]}, ${m[2]}, ${m[3]}) = **#${hx}**`;
    }
    // character codes
    if ((m = t.match(/^(?:what is the )?(?:ascii|char(?:acter)?|unicode) code (?:of|for) ["']?(.)["']?\s*\??$/i))) return `The code for "${m[1]}" is **${m[1].charCodeAt(0)}** (hex 0x${m[1].charCodeAt(0).toString(16).toUpperCase()}).`;
    if ((m = t.match(/^(?:what )?(?:character|char|letter) (?:is )?(?:code )?(\d{1,6})\s*\??$/i))) return `Character code ${m[1]} is **"${String.fromCodePoint(+m[1])}"**.`;
    return null;
  });

  // ---------------- 5. Explain error messages ----------------
  const ERRS = [
    [/cannot read propert(?:y|ies) of (undefined|null)(?: \(reading '([^']+)'\))?/i, (m) => `**What it means:** you tried to read \`.${m[2] || "something"}\` from a value that is **${m[1]}** — the thing before the dot doesn't exist yet.\n\n**Fix:** check where that value comes from (a typo, data that hasn't loaded, a missing element). Guard it: \`obj?.${m[2] || "prop"}\`, or \`if (obj) { … }\`. With DOM code, make sure \`querySelector\` actually found the element.`],
    [/(\w+) is not defined/i, (m) => /^name '/.test(m[0]) ? null : `**What it means:** the name \`${m[1]}\` doesn't exist where you used it (ReferenceError).\n\n**Fix:** check the spelling and capitals, declare it first (\`let ${m[1]} = …\`), or make sure the script/library that defines it loads before your code.`],
    [/(\S+) is not a function/i, (m) => `**What it means:** you called \`${m[1]}()\` but it isn't a function — it's undefined or a different type.\n\n**Fix:** check the spelling and that the method exists on that kind of value (e.g. \`map\` works on arrays, not objects). \`console.log(typeof ${m[1].replace(/\(.*$/, "")})\` shows what it really is.`],
    [/unexpected token|unexpected end of input|missing \) after argument list|unterminated string/i, () => `**What it means:** a **SyntaxError** — the code can't be read, usually a missing or extra bracket, quote or comma.\n\n**Fix:** look at the line it points to (and the line before). Count \`( ) { } [ ]\` pairs and quotes. If it says *Unexpected token <*, you probably loaded an HTML page where JSON/JS was expected.`],
    [/maximum call stack size exceeded|recursionerror/i, () => `**What it means:** a function kept calling itself forever (infinite **recursion**), so the call stack overflowed.\n\n**Fix:** make sure your recursive function has a **base case** that stops it, and that each call moves closer to it.`],
    [/uncaught \(in promise\)|unhandled promise rejection/i, () => `**What it means:** an \`async\` task (a Promise, e.g. \`fetch\`) failed and nothing caught the error.\n\n**Fix:** wrap \`await\` calls in \`try { … } catch (e) { … }\` or add \`.catch(e => …)\` to the promise.`],
    [/blocked by cors|cors policy|access-control-allow-origin/i, () => `**What it means:** the browser blocked a request to another website because that server didn't allow your page (**CORS**).\n\n**Fix:** you can't fix it from the page itself — the API must send an \`Access-Control-Allow-Origin\` header, or call it from your own server/proxy, or use an API that supports CORS.`],
    [/indentationerror|unexpected indent|expected an indented block/i, () => `**What it means:** Python uses indentation for blocks, and a line's spaces don't line up.\n\n**Fix:** indent everything inside \`if/for/def/class\` by the same amount (4 spaces is standard) and don't mix tabs and spaces.`],
    [/nameerror: name '([^']+)' is not defined/i, (m) => `**What it means:** Python doesn't know the name \`${m[1]}\`.\n\n**Fix:** check the spelling/capitals, assign it before using it, or \`import\` it (e.g. \`import math\` for \`math\`).`],
    [/typeerror: (?:can only concatenate str|unsupported operand type|must be str, not int|can't multiply sequence)/i, () => `**What it means:** you mixed types that don't go together, like text + number.\n\n**Fix:** convert first: \`str(5)\` to make text, \`int("5")\` or \`float("2.5")\` to make a number. Or use an f-string: \`f"Age: {age}"\`.`],
    [/indexerror: list index out of range|arrayindexoutofbounds|index (?:was )?out of range/i, () => `**What it means:** you asked for a position that doesn't exist in the list/array. Indexes start at **0**, so the last item is \`length - 1\`.\n\n**Fix:** check the list isn't empty and loop with \`range(len(items))\` / \`i < arr.length\` (not \`<=\`).`],
    [/keyerror: ?'?([^'\n]*)'?/i, (m) => `**What it means:** the dictionary has no key \`${m[1] || "…"}\`.\n\n**Fix:** check the spelling, use \`d.get("${m[1] || "key"}")\` (returns None instead of crashing), or check \`if "${m[1] || "key"}" in d:\` first.`],
    [/zerodivisionerror|division by zero|divide by zero/i, () => `**What it means:** you divided by **zero**, which has no answer.\n\n**Fix:** check the divisor first: \`if count != 0:\` before \`total / count\`.`],
    [/modulenotfounderror: no module named '([^']+)'|cannot find module '([^']+)'/i, (m) => `**What it means:** the package \`${m[1] || m[2]}\` isn't installed (or the name/path is wrong).\n\n**Fix:** install it — Python: \`pip install ${m[1] || "package"}\`, Node: \`npm install ${m[2] || "package"}\` — and check the spelling. For your own files, check the relative path (\`./file.js\`).`],
    [/nullpointerexception/i, () => `**What it means (Java):** you used an object variable that is **null** (calling a method on it or reading a field).\n\n**Fix:** make sure it's created with \`new\` or assigned before use, or check \`if (obj != null)\`. The stack trace's top line shows exactly where.`],
    [/segmentation fault|segfault|access violation/i, () => `**What it means (C/C++):** the program touched memory it doesn't own — often a null or dangling pointer, or going past the end of an array.\n\n**Fix:** check pointers before using them, array bounds, and don't use memory after \`free\`/\`delete\`. Tools like AddressSanitizer (\`-fsanitize=address\`) point to the exact line.`],
    [/\b404\b.*not found|not found.*\b404\b/i, () => `**What it means:** the server couldn't find that address (**404 Not Found**).\n\n**Fix:** check the URL/path spelling and capitals, and that the file is really deployed there.`],
    [/\b(500|internal server error)\b/i, () => `**What it means:** the **server** crashed while handling the request (**500**). It's a problem on the server side, not the browser.\n\n**Fix:** look at the server's logs for the real error message.`],
  ];
  Brain.addSkill((text) => {
    if (!/error|exception|fault|not defined|not a function|cannot read|unexpected|out of range|cors|\b404\b|\b500\b/i.test(text)) return null;
    for (const [re, fn] of ERRS) { const m = text.match(re); if (m) { const r = fn(m); if (r) return r; } }
    return null;
  });
})();
