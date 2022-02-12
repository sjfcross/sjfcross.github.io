// let die1 = Math.floor(Math.random()*6)+1;

function singSong() {
  console.log("DO");
  console.log("RE");
  console.log("MI");
}

// singSong()
// singSong()
// singSong()
// singSong()
// singSong()
// singSong()
// singSong()
// singSong()

// function greet() {
//   console.log("Hi!")
// }

// function greet(person) {
//   console.log(`Hi, ${person}!`);
// }

//   function greet(firstName) {
//  console.log(`firstName is ${firstName}`);
//   }

// function greet(firstName) {
//   console.log(`Hey there, ${firstName}!`)
// }




// Rant Exercise

function rant(message) {
  console.log(`${message}`.toUpperCase());
  console.log(`${message}`.toUpperCase());
  console.log(`${message}`.toUpperCase());
}



// INclude multiple Arguments

function greet(firstName, lastName) {
  console.log(`Hey there, ${firstName} ${lastName[0]}.`);
}



// repeat string num times

function repeat(str, numTimes) {
  let result = "";
  for (let i = 0; i < numTimes; i++) {
    result += str;
  }
  console.log(result);
}


// Define isSnakeEyes below:

function isSnakeEyes(die1, die2) {
  if (die1 === 1 && die2 === 1) {
      console.log('Snake Eyes!');
  } else {
     console.log('Not Snake Eyes!');
  }
}