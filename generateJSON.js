const fs = require('fs-extra');
const marked = require('marked');
const cheerio = require('cheerio');
const {exec} = require('child_process');

require('dotenv').config();

const tacofancyPath = process.env.TACO_FANCY_PATH;

const layers = [
  "base_layers",
  "condiments",
  "mixins",
  "seasonings",
  "shells"
];

const layersByType = {};
const errors = [];

function getRecipes() {
  return Promise.all(layers.map(async function(layer) {
    const path = tacofancyPath + layer;
    layersByType[layer] = [];
    const recipes = await fs.readdir(path);
    return Promise.all(recipes.map(async function(fileName) {
      if(fileName.endsWith('.md') && fileName != 'README.md') {
        const fullRecipe = await fs.readFile(`${path}/${fileName}`, 'utf-8');
        const htmlRecipe = marked(fullRecipe);
        const $ = cheerio.load(`<div>${htmlRecipe}</div>`);
        const title = $('h1').text();

        let description = '';

        let descriptionElement = $('#description').next();
        if(descriptionElement.length > 0) {
          description = descriptionElement.text();
          descriptionElement = descriptionElement.next();
          while(descriptionElement[0].tagName != 'h2') {
            description += '\n\n' + descriptionElement.text();
            descriptionElement = descriptionElement.next();
          }
        }

        let ingredientsElement = $('#ingredients').next();
        let ingredients = getItems(ingredientsElement, 'ingredients');

        function getItems(listElement, name) {
          const items = [];
          let itemElements = listElement.children('li');
          itemElements.each(function() {
            let $list = $(this).children('ul');
            let childElements = $list.children('li');
            let title = $(this).clone().children().remove().end().text().trim();
            if(childElements.length == 0) {
              items.push(title);
            } else {
              items.push({
                title,
                [name]: getItems($list, name)
              })
            }
          });
          return items;
        }

        let directions = [];

        let directionsList = $('#directions').next();
        if(directionsList.length > 0) {
          directions = getItems(directionsList, 'directions');
        }

        let notes = [];

        let notesList = $('#notes').next();
        if(notesList.length > 0) {
          notes = getItems(notesList, 'notes');
        }

        const tagP = $('p').last();
        let tags = [];

        if(tagP.length > 0) {
          const tagPContents = tagP.text();
          if(tagPContents.startsWith('tags:')) {
            tags = tagPContents.split('tags:')[1].split(',');
            tags = tags.map(t => t.trim());
          }
        }

        const info = await new Promise((resolve, reject) => {
          exec(`cd ${process.env.TACO_FANCY_PATH} && git log --diff-filter=A -- ${layer}/${fileName}`, (err, stdout, stderr) => {
            let created = '';
            let author = '';

            if(!err && stdout) {
              created = stdout.match(/Date:(.*)/g)[0].split('Date:')[1].trim();
              author = stdout.match(/Author:(.*)/g)[0].split('Author:')[1].trim();
            } else {
              console.log('no commit history found', `${layer}/${fileName}`);
            }

            resolve({
              created,
              author
            });
          });
        });

        layersByType[layer].push({
          title,
          description,
          ingredients,
          directions,
          notes,
          tags,
          created: info.created,
          author: info.author
        });
      }
    }));
  }));
}

getRecipes()
  .then(() => {
    fs.writeFileSync('layers.json', JSON.stringify(layersByType));
    console.log('done');
  });
