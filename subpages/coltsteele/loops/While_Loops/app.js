// let count = 0;
// while (count < 10) {
//     count++;
//     console.log(count)
// }

// let count = 0;
// while (count < 10) {
//     count++;
// console.log(count)
// }

// const SECRET = "BabyHippo";
// let guess = prompt("enter the secret code");
// while (guess != SECRET) {
//     guess = prompt("enter the secret code");
// }
// console.log("Congrats, that is the Secret !")

// const SECRET = "BabyHippo";

// let guess = prompt("enter the secret code...");
// while (guess !== SECRET) {
//     guess = prompt("enter the secret code...");
// }
// console.log("CONGRATS YOU GOT THE SECRET!!!")

// let input = prompt("Hey, say something!")
// while (true) {
//     input = prompt(input + "?" );
//     if (input.toLowerCase() === "stop copying me") break;
// }
// console.log("OK, YOU WIN !!")

// let input = prompt("Hey, say something!")
// while (true) {
//     input = prompt(input);
//     if (input.toLowerCase() === "stop copying me") break;
// }
// console.log("OK YOU WIN!")

// for (let i = 0; i < 1000; i++) {
//     console.log(i);
//     if (i === 789) break;
// }

let maximum = parseInt(prompt("Insert you max Number!"));

while (!maximum) {
  maximum = parseInt(prompt("Enter a valid Number !"));
}

const targetNum = Math.floor(Math.random() * maximum) + 1;

console.log(targetNum);

let guess = parseInt(prompt("Enter your first guess!"));
let attempt = 1;

while (parseInt(guess) !== targetNum) {
  if (guess === "q") break;
  attempt++;
  if (guess > targetNum) {
    guess = prompt("Too high ! Enter a new guess:");
  } else {
    guess = prompt("Too low ! Enter a new guess:");
  }
}
if (guess === "q") {
  console.log("Quitter !!!!");
} else {
  console.log(`YOU GOT IT !!! It took you ${attempt} guesses.`);
}

// let maximum = parseInt(prompt("Enter the maximum number!"));
// while (!maximum) {
//     maximum = parseInt(prompt("Enter a valid number!"));
// }

// const targetNum = Math.floor(Math.random() * maximum) + 1;

// let guess = parseInt(prompt("Enter your first guess!"));
// let attempts = 1;

// while (parseInt(guess) !== targetNum) {
//     if (guess === 'q') break;
//     attempts++;
//     if (guess > targetNum) {
//         guess = prompt("Too high! Enter a new guess:");
//     } else {
//         guess = prompt("Too low! Enter a new guess:");
//     }
// }

// if (guess === 'q') {
//     console.log("OK, YOU QUIT!")
// } else {
//     console.log("CONGRATS YOU WIN!")
//     console.log(`You got it! It took you ${attempts} guesses`)
// }
