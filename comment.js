/*global jQuery, Handlebars, Router */
jQuery(function ($) {
  'use strict';
  ///setting up an equals helper with Handlebars and Ember 2.0
  Handlebars.registerHelper('eq', function (a, b, options) {
    ///"show" function will take a context and return a String.
    return a === b ? options.fn(this) : options.inverse(this);
  });

  var ENTER_KEY = 13;
  var ESCAPE_KEY = 27;
 ////ajax is the way the site "talks" to the server
  var ajax = {     ///server url
    baseUrl: 'https://fathomless-woodland-51903.herokuapp.com/todos',
    headers: {   ////server "password"
      'Authorization': 'Token token=supadupasecret'
    },
    ///JavaScript Object Notation
    getJSON: function (callback) {
      $.getJSON({ ///using 1of 4 methods to get JS info
        url: this.baseUrl,
        headers: this.headers,    ////server "password" another way
        success: function (response) {
          callback(response.data)
        }
      })
    },
    create: function (value, callback) {
      ///function with two arguments that creates
      $.post({  //// this is used to send server the user info
        url: this.baseUrl,
        headers: this.headers,
        data: { todo: { todo: value } }, ///nested data. todo:value w/in todo
        success: function (response) {
          callback(response.data)
        }
      })
    },
    ///function with one argument that destroys
    destroy: function (todo) {
      if(todo.id.includes('-')) ///todo id with - gets returned to an AJAX that
        return;                 ///DELETES from list, then gets passed into another
      $.ajax({                  ///AJAX that puts it in a completed area.
        type: "DELETE",
        url: `${this.baseUrl}/${todo.id}`,
        headers: this.headers
      });
    },
    update: function (todo) {
      if(todo.id.includes('-'))
        return;
      $.ajax({
        type: "PUT",
        url: `${this.baseUrl}/${todo.id}`,
        headers: this.headers,
        data: {
          todo: {
            todo: todo.title,
            isComplete: todo.completed
          }
        }
      });
    }
  };

  var util = {      ///just a TOTAL guess here, but I believe all this math (util)
    uuid: function () { ///is used to make an id (uuid)
      /*jshint bitwise:false */
      var i, random;
      var uuid = '';

      for (i = 0; i < 32; i++) {
        random = Math.random() * 16 | 0;
        if (i === 8 || i === 12 || i === 16 || i === 20) {
          uuid += '-';
        }
        uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
      }

      return uuid; ///this is where the todo id is returned, maybe for url?!?
    },
    pluralize: function (count, word) { ///whole area to pluralize fixed
      return count === 1 ? word : word + 's';///words in the app
    },                                       ///if the word turns plural, add 's'
    store: function (namespace, data) {
      if (arguments.length > 1) { ///recalling JSON to "store" two arguments
        return localStorage.setItem(namespace, JSON.stringify(data));
      } else {                      ///turns the object into a string
        var store = localStorage.getItem(namespace);
        return (store && JSON.parse(store)) || [];
      }
    }
  };

  var App = { ////using handlebars to assign info to HTML tags
    init: function () {
      this.todos = util.store('todos-jquery');
      this.todoTemplate = Handlebars.compile($('#todo-template').html());
      this.footerTemplate = Handlebars.compile($('#footer-template').html());
      this.bindEvents();
      ajax.getJSON(this.integrateList.bind(this));///binding info through JSON

      var router = new Router({   ///kind of like a prototype??
        '/:filter': (filter) => this.renderFiltered(filter)
      })
      router.init('/all'); ///turn out all info with added /all to url
    },
    bindEvents: function () { ///binding all the Var's above to HTML
      $('#new-todo').on('keyup', e => this.create(e));
      $('#toggle-all').on('change', e => this.toggleAll(e));
      $('#footer').on('click', '#clear-completed', e => destroyCompleted(e));
      $('#todo-list')
      .on('change', '.toggle', e => this.toggle(e))
        .on('dblclick', 'label', e => this.edit(e))
        .on('keyup', '.edit', e => this.editKeyup(e))
        .on('focusout', '.edit', e => this.update(e))
        .on('click', '.destroy', e => this.destroy(e));
    },
    renderFiltered: function(filter){ //app filter, then render all above
      this.filter = filter;
      this.render();
    },
    render: function () {   ///function to suit up some handlebar tags
      var todos = this.getFilteredTodos();  ///'this' refers to app.
      $('#todo-list').html(this.todoTemplate(todos));
      $('#main').toggle(todos.length > 0);
      $('#toggle-all').prop('checked', this.getActiveTodos().length === 0);
      this.renderFooter();
      $('#new-todo').focus();
      util.store('todos-jquery', this.todos);
    },
    renderFooter: function () { ///rendering of info in the completed area of site
      var todoCount = this.todos.length;
      var activeTodoCount = this.getActiveTodos().length;
      var template = this.footerTemplate({
        activeTodoCount: activeTodoCount,
        activeTodoWord: util.pluralize(activeTodoCount, 'item'),
        completedTodos: todoCount - activeTodoCount,
        filter: this.filter
      });

      $('#footer').toggle(todoCount > 0).html(template);
    },
    toggleAll: function (e) {  ///toggle to get box checked
      var isChecked = $(e.target).prop('checked');

      this.todos.forEach(todo => { ///moving checked to the isChecked section
        todo.completed = isChecked;
        ajax.update(todo);
      });

      this.render(); ///execute toggle when it happens
    },
    getActiveTodos: function () {
      return this.todos.filter(todo => !todo.completed);
    },
    getCompletedTodos: function () { ///filtering todo's into completed
      return this.todos.filter(todo => todo.completed);
    },
    getFilteredTodos: function () { ///if toggled is active keep
      if (this.filter === 'active') {
        return this.getActiveTodos();
      }

      if (this.filter === 'completed') {///if toggled completed, move to
        return this.getCompletedTodos();///completed todo's
      }

      return this.todos;///seperating todo's from active and completed
    },
    destroyCompleted: function () {///using AJAX to destroy 'ALL' completed
      this.getCompletedTodos().forEach(todo => ajax.destroy(todo));
      this.todos = this.getActiveTodos();
      this.filter = 'all';
      this.render();
    },
    // accepts an element from inside the `.item` div and
    // returns the corresponding index in the `todos` array
    indexFromEl: function (el) {
      var id = String($(el).closest('li').data('id'));
      var todos = this.todos;
      var i = todos.length;

      while (i--) {
        if (todos[i].id === id) {
          return i;
        }
      }
    },
    create: function (e) { ///creating a "create" that uses the
      var $input = $(e.target);///"enter key" to post the user info
      var val = $input.val().trim();

      if (e.which !== ENTER_KEY || !val) {
        return;
      }

      var uuid = util.uuid();///id gets added to the value, if there is
      this.integrate(uuid, val);///a "same" input twice?!?!?
      ajax.create(val, this.replace(uuid, this));

      $input.val('');

      this.render();
    },
    replace: (oldId, context) => {///"same" input gets old id if it's
      return (newTodo) => {///same?!?!
        var todo = context.todos.find((todo) => todo.id === oldId);
        todo.id = newTodo.id;
        util.store('todos-jquery', context.todos);
      }
    },
    toggle: function (e) {
      var i = this.indexFromEl(e.target);
      var todo = this.todos[i];
      todo.completed = !todo.completed;
      ajax.update(todo);
      this.render();
    },
    edit: function (e) {
      var $input = $(e.target).closest('li').addClass('editing').find('.edit');
      $input.val($input.val()).focus();
    },
    editKeyup: function (e) {
      if (e.which === ENTER_KEY) {
        e.target.blur();
      }

      if (e.which === ESCAPE_KEY) {
        $(e.target).data('abort', true).blur();
      }
    },
    update: function (e) {
      var el = e.target;
      var $el = $(el);
      var val = $el.val().trim();

      if (!val) {
        this.destroy(e);
        return;
      }

      if ($el.data('abort')) {
        $el.data('abort', false);
      } else {
        var todo = this.todos[this.indexFromEl(el)];
        todo.title = val;
        ajax.update(todo);
      }

      this.render();
    },
    destroy: function (e) {
      var todo = this.todos.splice(this.indexFromEl(e.target), 1)[0];
      ajax.destroy(todo);
      this.render();
    },
    notIntegrated: function (todo) {
      return !this.todos.map((todo) => todo.id).includes(todo.id);
    },
    integrate: function (id, title, completed) {
      this.todos.push({
        id: id,
        title: title,
        completed: completed || false
      });
    },
    integrateList: function (data) {
      data.filter((todo) => this.notIntegrated(todo))
          .forEach(todo => this.integrate(todo.id,
                                          todo.attributes.id,
                                          todo.attributes['is-complete']));
      this.render();
    }
  };

  App.init();
});
