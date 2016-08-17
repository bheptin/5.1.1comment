/*global jQuery, Handlebars, Router */
jQuery(function ($) {
  'use strict';

  Handlebars.registerHelper('eq', function (a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
  });

  var ENTER_KEY = 13;
  var ESCAPE_KEY = 27;

  var ajax = {
    baseUrl: 'http://localhost:3000/todos',
    headers: {
      'Authorization': 'Token token=supadupasecret'
    },
    getJSON: function (callback) {
      $.getJSON({
        url: this.baseUrl,
        headers: this.headers,
        success: function (response) {
          callback(response.data)
        }
      })
    },
    create: function (value, callback) {
      $.post({
        url: this.baseUrl,
        headers: this.headers,
        data: { todo: { todo: value } },
        success: function (response) {
          callback(response.data)
        }
      })
    },
    destroy: function (todo) {
      if(todo.id.includes('-'))
        return;
      $.ajax({
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

  var util = {
    uuid: function () {
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

      return uuid;
    },
    pluralize: function (count, word) {
      return count === 1 ? word : word + 's';
    },
    store: function (namespace, data) {
      if (arguments.length > 1) {
        return localStorage.setItem(namespace, JSON.stringify(data));
      } else {
        var store = localStorage.getItem(namespace);
        return (store && JSON.parse(store)) || [];
      }
    }
  };

  var App = {
    init: function () {
      this.todos = util.store('todos-jquery');
      this.todoTemplate = Handlebars.compile($('#todo-template').html());
      this.footerTemplate = Handlebars.compile($('#footer-template').html());
      this.bindEvents();
      ajax.getJSON(this.integrateList.bind(this));

      var router = new Router({
        '/:filter': (filter) => this.renderFiltered(filter)
      })
      router.init('/all');
    },
    bindEvents: function () {
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
    renderFiltered: function(filter){
      this.filter = filter;
      this.render();
    },
    render: function () {
      var todos = this.getFilteredTodos();
      $('#todo-list').html(this.todoTemplate(todos));
      $('#main').toggle(todos.length > 0);
      $('#toggle-all').prop('checked', this.getActiveTodos().length === 0);
      this.renderFooter();
      $('#new-todo').focus();
      util.store('todos-jquery', this.todos);
    },
    renderFooter: function () {
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
    toggleAll: function (e) {
      var isChecked = $(e.target).prop('checked');

      this.todos.forEach(todo => {
        todo.completed = isChecked;
        ajax.update(todo);
      });

      this.render();
    },
    getActiveTodos: function () {
      return this.todos.filter(todo => !todo.completed);
    },
    getCompletedTodos: function () {
      return this.todos.filter(todo => todo.completed);
    },
    getFilteredTodos: function () {
      if (this.filter === 'active') {
        return this.getActiveTodos();
      }

      if (this.filter === 'completed') {
        return this.getCompletedTodos();
      }

      return this.todos;
    },
    destroyCompleted: function () {
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
    create: function (e) {
      var $input = $(e.target);
      var val = $input.val().trim();

      if (e.which !== ENTER_KEY || !val) {
        return;
      }

      var uuid = util.uuid();
      this.integrate(uuid, val);
      ajax.create(val, this.replace(uuid, this));

      $input.val('');

      this.render();
    },
    replace: (oldId, context) => {
      return (newTodo) => {
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
